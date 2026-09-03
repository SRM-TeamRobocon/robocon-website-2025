import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { buildRecruitProfiles, displayFirstName } from "../queue/route";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const TOKEN_COLUMNS =
  "id, token_number, queue_position, status, checked_in_at, called_at, recruit_id, is_walkin, review_note, rating, interested_other_clubs, interested_other_domains, review_updated_by, review_updated_at";

// Bounded so a pathological race (or a stale read) can never spin.
const MAX_ATTEMPTS = 5;

// A `called` token nobody resolved would otherwise block this panel's Call Next
// forever (only one `called` token per panel is allowed at a time). Self-healed
// inline in findCalled() below rather than via a periodic cron sweep.
const NO_SHOW_TIMEOUT_MINUTES = 15;

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
  is_hosteller: false,
  hostel_block: null as string | null,
  hostel_room: null as string | null,
  day_scholar_area: null as string | null,
  travel_method: null as string | null,
  gender: null as string | null,
  phone: null as string | null,
});

type TokenRow = {
  id: string;
  token_number: number;
  queue_position: number;
  status: string;
  checked_in_at: string;
  called_at: string | null;
  recruit_id: string;
  is_walkin: boolean;
  review_note: string | null;
  rating: "bad" | "average" | "good" | null;
  interested_other_clubs: string | null;
  interested_other_domains: string | null;
  review_updated_by: string | null;
  review_updated_at: string | null;
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
// status guard - two students called at once, and since the dashboard only renders the FIRST
// `called` token, Call Next stayed disabled forever and the panel jammed. Two guards now:
//
//   1. Idempotency - if a `called` token already exists for this panel, return it instead of
//      calling anyone else. A second click/device gets the same recruit back, not a new one.
//   2. Compare-and-swap - the update is conditioned on `.eq("status", "waiting")`, so only
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
    const [profiles, reviewerNames] = await Promise.all([
      buildRecruitProfiles(supabase, [token.recruit_id]),
      resolveDisplayNames(supabase, [token.review_updated_by]),
    ]);
    const recruit = profiles.get(token.recruit_id) ?? EMPTY_PROFILE(token.recruit_id);

    return NextResponse.json({
      token_id: token.id,
      token_number: token.token_number,
      status: token.status,
      recruit,
      checked_in_at: token.checked_in_at,
      called_at: token.called_at ?? undefined,
      already_called: alreadyCalled,
      is_walkin: Boolean(token.is_walkin),
      review_note: token.review_note ?? null,
      rating: token.rating ?? null,
      interested_other_clubs: token.interested_other_clubs ?? null,
      interested_other_domains: token.interested_other_domains ?? null,
      review_updated_by: token.review_updated_by
        ? reviewerNames.get(token.review_updated_by) ?? token.review_updated_by
        : null,
      review_updated_at: token.review_updated_at ?? null,
    });
  };

  const findCalled = async (): Promise<TokenRow | null> => {
    const { data, error } = await supabase
      .from("recruit_interview_tokens")
      .select(TOKEN_COLUMNS)
      .eq("panel_id", id)
      .eq("status", "called")
      .order("queue_position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const called = data as TokenRow | null;
    if (!called) return null;

    const isStale =
      called.called_at !== null &&
      Date.now() - new Date(called.called_at).getTime() > NO_SHOW_TIMEOUT_MINUTES * 60_000;

    if (isStale) {
      // Flip it out of the way (CAS-guarded in case someone resolves it concurrently)
      // and treat it as if nothing were called, so the caller falls through to the
      // waiting-token loop below.
      await supabase
        .from("recruit_interview_tokens")
        .update({ status: "no_show" })
        .eq("id", called.id)
        .eq("status", "called");
      return null;
    }

    return called;
  };

  try {
    const existingCalled = await findCalled();
    if (existingCalled) {
      return await respond(existingCalled, true);
    }

    // Walk forward through waiting tokens ordered by queue_position (the
    // manually-reorderable "who's next" order, not the recruit's fixed token_number),
    // excluding ids already tried this request rather than re-reading the same one.
    //
    // Deliberately NOT `.gt("queue_position", afterPosition)`: Postgres's NULL > x is
    // NULL (never true), so that filter silently drops any row whose queue_position is
    // null from EVERY attempt, including the first - a panel with real waiting tokens
    // reports `queue_empty` forever. It happened live: a batch of tokens ended up with
    // null queue_position (a migration backfill that never ran against this DB) and
    // every affected panel's Call Next was permanently stuck despite a visibly nonempty
    // queue. Excluding by id sidesteps the comparison entirely, so this class of bug
    // can't recur even if some future row is ever null again.
    const triedIds: string[] = [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let query = supabase
        .from("recruit_interview_tokens")
        .select(TOKEN_COLUMNS)
        .eq("panel_id", id)
        .eq("status", "waiting")
        .order("queue_position", { ascending: true, nullsFirst: true })
        .limit(1);

      if (triedIds.length > 0) {
        query = query.not("id", "in", `(${triedIds.join(",")})`);
      }

      const { data: candidate, error: fetchError } = await query.maybeSingle();

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
      triedIds.push(next.id);
    }

    // Every attempt lost its race and nothing is `called` - extremely unlikely, and safe to
    // retry from the client.
    return NextResponse.json(
      { error: "Queue is busy right now - try Call Next again" },
      { status: 409 }
    );
  } catch (error) {
    console.error("recruitment call-next error", error);
    return NextResponse.json({ error: "Could not call the next recruit" }, { status: 500 });
  }
}
