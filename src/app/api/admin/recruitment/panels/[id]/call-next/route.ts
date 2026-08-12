import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { buildRecruitProfiles, displayFirstName } from "../queue/route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const TOKEN_COLUMNS = "id, token_number, status, checked_in_at, called_at, recruit_id";

// Bounded so a pathological race (or a stale read) can never spin.
const MAX_ATTEMPTS = 5;

const EMPTY_PROFILE = (recruitId: string) => ({
  id: recruitId,
  name: "Unknown",
  first_name: displayFirstName("Unknown"),
  reg_no: "",
  year: "",
  department: "",
  domains: [] as string[],
  exam_marks: [] as { sub_domain: string; marks: number }[],
  shortlisted_for: [] as string[],
});

type TokenRow = {
  id: string;
  token_number: number;
  status: string;
  checked_in_at: string;
  called_at: string | null;
  recruit_id: string;
};

// POST /api/admin/recruitment/panels/:id/call-next
//
// Flips the oldest `waiting` token for this panel (token_number ASC) to `called` and returns
// the same token+recruit shape as GET .../queue. Returns { status: 'queue_empty' } when
// nothing is waiting.
//
// Concurrency: "one called recruit per panel" used to exist only in the dashboard UI, which
// learns about state through a 5s poll. Two devices on the same panel (or one impatient
// double-click) both read the same oldest waiting token and both updated it by id with no
// status guard — two students called at once, and since the dashboard only renders the FIRST
// `called` token, Call Next stayed disabled forever and the panel jammed. Two guards now:
//
//   1. Idempotency — if a `called` token already exists for this panel, return it instead of
//      calling anyone else. A second click/device gets the same recruit back, not a new one.
//   2. Compare-and-swap — the update is conditioned on `.eq("status", "waiting")`, so only
//      one concurrent request can win. The loser gets zero rows back and either returns the
//      winner's now-`called` token or moves on to the next waiting number.
export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createRecruitSupabaseAdminClient();

  const respond = async (token: TokenRow, alreadyCalled: boolean) => {
    const profiles = await buildRecruitProfiles(supabase, [token.recruit_id]);
    const recruit = profiles.get(token.recruit_id) ?? EMPTY_PROFILE(token.recruit_id);

    return NextResponse.json({
      token_id: token.id,
      token_number: token.token_number,
      status: token.status,
      recruit,
      checked_in_at: token.checked_in_at,
      called_at: token.called_at ?? undefined,
      already_called: alreadyCalled,
    });
  };

  const findCalled = async (): Promise<TokenRow | null> => {
    const { data, error } = await supabase
      .from("recruit_interview_tokens")
      .select(TOKEN_COLUMNS)
      .eq("panel_id", id)
      .eq("status", "called")
      .order("token_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as TokenRow | null) ?? null;
  };

  try {
    const existingCalled = await findCalled();
    if (existingCalled) {
      return await respond(existingCalled, true);
    }

    // Walk forward through waiting tokens by number rather than re-reading the same one:
    // if we lost the race for #12, the next candidate is the first waiting token above #12.
    let afterNumber = -1;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { data: candidate, error: fetchError } = await supabase
        .from("recruit_interview_tokens")
        .select(TOKEN_COLUMNS)
        .eq("panel_id", id)
        .eq("status", "waiting")
        .gt("token_number", afterNumber)
        .order("token_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw new Error(fetchError.message);
      if (!candidate) {
        return NextResponse.json({ status: "queue_empty" });
      }

      const next = candidate as TokenRow;

      const { data: updated, error: updateError } = await supabase
        .from("recruit_interview_tokens")
        .update({ status: "called", called_at: new Date().toISOString() })
        .eq("id", next.id)
        .eq("status", "waiting")
        .select(TOKEN_COLUMNS)
        .maybeSingle();

      if (updateError) throw new Error(updateError.message);

      if (updated) {
        return await respond(updated as TokenRow, false);
      }

      // Zero rows updated => somebody else moved this token out of `waiting` between our
      // read and our write. If they called it, hand back their token (idempotent); if they
      // marked it no_show/done, continue with the next waiting number.
      const raced = await findCalled();
      if (raced) {
        return await respond(raced, true);
      }
      afterNumber = next.token_number;
    }

    // Every attempt lost its race and nothing is `called` — extremely unlikely, and safe to
    // retry from the client.
    return NextResponse.json(
      { error: "Queue is busy right now — try Call Next again" },
      { status: 409 }
    );
  } catch (error) {
    console.error("recruitment call-next error", error);
    return NextResponse.json({ error: "Could not call the next recruit" }, { status: 500 });
  }
}
