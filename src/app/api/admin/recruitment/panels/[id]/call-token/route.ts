import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { buildRecruitProfiles, displayFirstName } from "../queue/route";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const TOKEN_COLUMNS =
  "id, token_number, queue_position, status, checked_in_at, called_at, recruit_id, is_walkin, panel_id, sub_domain, review_note, rating, interested_other_clubs, interested_other_domains, review_updated_by, review_updated_at";

// Postgres unique_violation - fired by the (panel_id, token_number) backstop when this
// route's freshly-computed token_number collides with a concurrent check-in/call onto
// the same target panel.
const UNIQUE_VIOLATION = "23505";
const MAX_ATTEMPTS = 5;

// Keep in sync with call-next/route.ts - both self-heal the same "one called recruit
// per table at a time" invariant the same way, so a table's Call Next and its shared
// -queue "Call to <table>" buttons never disagree about whether it's free.
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
  panel_id: string;
  sub_domain: string | null;
  review_note: string | null;
  rating: "bad" | "average" | "good" | null;
  interested_other_clubs: string | null;
  interested_other_domains: string | null;
  review_updated_by: string | null;
  review_updated_at: string | null;
};

// POST /api/admin/recruitment/panels/:id/call-token
// Body: { token_id: string }
//
// Manual, cross-table call: an interviewer working panel :id can pull ANY `waiting`
// recruit from their sub_domain's shared queue to their own table, even if that
// recruit was originally auto-routed (or drag-reordered) onto a DIFFERENT table for
// the same domain. Complements call-next (which only ever pulls the front of THIS
// panel's own queue) - both stay available in the UI side by side.
//
// If the token is already on this panel, this is just a manual override of FIFO order
// (flip straight to `called`). If it's on a different panel, calling it also reassigns
// panel_id and allocates a FRESH token_number + queue_position scoped to the new panel
// - same read-max-then-write pattern, and the same retry-on-23505 discipline, used at
// check-in time (scan/route.ts) and by close-for-day's redistribution
// (recruit-interview-redistribution.ts). This has to happen here, in the same request
// as the reassignment, not via a trigger - see the schema file's note on token_number
// allocation for why.
//
// Rejects (400) a token that isn't `waiting`, or whose sub_domain doesn't match this
// panel's - a recruit can never be pulled into a table for a different domain than the
// one they checked into.
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: panelId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const tokenId = typeof body.token_id === "string" ? body.token_id : "";
  if (!tokenId) {
    return NextResponse.json({ error: "token_id is required" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: panel, error: panelError } = await supabase
    .from("recruit_interview_panels")
    .select("id, sub_domain, is_active, domain_label")
    .eq("id", panelId)
    .maybeSingle();

  if (panelError) {
    console.error("call-token: panel lookup error", panelError);
    return NextResponse.json({ error: "Could not call this recruit" }, { status: 500 });
  }
  if (!panel) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }
  if (!panel.is_active) {
    return NextResponse.json({ error: "This table is closed" }, { status: 400 });
  }
  if (!panel.sub_domain) {
    return NextResponse.json({ error: "This table has no domain set - cannot call to it" }, { status: 400 });
  }

  const respond = async (token: TokenRow) => {
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

  try {
    // Same "one called recruit per table at a time" rule call-next enforces, including
    // its self-healing stale-called timeout - a table an interviewer forgot to resolve
    // shouldn't block a manual call any longer than it blocks Call Next.
    const { data: existingCalledRaw, error: calledError } = await supabase
      .from("recruit_interview_tokens")
      .select(TOKEN_COLUMNS)
      .eq("panel_id", panelId)
      .eq("status", "called")
      .order("queue_position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (calledError) throw new Error(calledError.message);
    const existingCalled = existingCalledRaw as TokenRow | null;

    if (existingCalled) {
      const isStale =
        existingCalled.called_at !== null &&
        Date.now() - new Date(existingCalled.called_at).getTime() > NO_SHOW_TIMEOUT_MINUTES * 60_000;

      if (!isStale) {
        return NextResponse.json(
          { error: "This table already has a recruit being interviewed" },
          { status: 409 }
        );
      }
      // Flip it out of the way (CAS-guarded in case someone resolves it concurrently)
      // and fall through - the table is free again.
      await supabase
        .from("recruit_interview_tokens")
        .update({ status: "no_show" })
        .eq("id", existingCalled.id)
        .eq("status", "called");
    }

    const { data: tokenRaw, error: tokenError } = await supabase
      .from("recruit_interview_tokens")
      .select(TOKEN_COLUMNS)
      .eq("id", tokenId)
      .maybeSingle();

    if (tokenError) throw new Error(tokenError.message);
    const token = tokenRaw as TokenRow | null;
    if (!token) {
      return NextResponse.json({ error: "Recruit not found" }, { status: 404 });
    }
    if (token.status !== "waiting") {
      return NextResponse.json(
        { error: "This recruit isn't waiting anymore - refresh the queue" },
        { status: 400 }
      );
    }
    if (token.sub_domain !== panel.sub_domain) {
      return NextResponse.json({ error: "This recruit isn't in this table's domain" }, { status: 400 });
    }

    // Already on this panel - just a manual FIFO override, no reassignment needed.
    if (token.panel_id === panelId) {
      const { data: updated, error: updateError } = await supabase
        .from("recruit_interview_tokens")
        .update({ status: "called", called_at: new Date().toISOString() })
        .eq("id", tokenId)
        .eq("status", "waiting")
        .select(TOKEN_COLUMNS)
        .maybeSingle();

      if (updateError) throw new Error(updateError.message);
      if (!updated) {
        return NextResponse.json(
          { error: "Someone else just called this recruit - refresh the queue" },
          { status: 409 }
        );
      }
      return await respond(updated as TokenRow);
    }

    // Cross-table: reassign panel_id, allocating a fresh token_number + queue_position
    // scoped to the target panel, bounded-retrying on a token_number collision exactly
    // like scan/route.ts's check-in insert does.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const [{ data: maxTokenRow }, { data: maxPositionRow }] = await Promise.all([
        supabase
          .from("recruit_interview_tokens")
          .select("token_number")
          .eq("panel_id", panelId)
          .order("token_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("recruit_interview_tokens")
          .select("queue_position")
          .eq("panel_id", panelId)
          .order("queue_position", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const nextTokenNumber = (maxTokenRow?.token_number ?? 0) + 1;
      const nextQueuePosition = (maxPositionRow?.queue_position ?? 0) + 1000;

      const { data: updated, error: updateError } = await supabase
        .from("recruit_interview_tokens")
        .update({
          panel_id: panelId,
          token_number: nextTokenNumber,
          queue_position: nextQueuePosition,
          status: "called",
          called_at: new Date().toISOString(),
        })
        .eq("id", tokenId)
        .eq("status", "waiting")
        .select(TOKEN_COLUMNS)
        .maybeSingle();

      if (!updateError) {
        if (!updated) {
          return NextResponse.json(
            { error: "Someone else just called this recruit - refresh the queue" },
            { status: 409 }
          );
        }
        return await respond(updated as TokenRow);
      }

      if (updateError.code !== UNIQUE_VIOLATION) {
        throw new Error(updateError.message);
      }
      // A concurrent check-in or another manual call landed the same token_number on
      // this panel between our read and our write - loop around and recompute the max.
    }

    return NextResponse.json({ error: "Table is busy right now - try calling again" }, { status: 409 });
  } catch (error) {
    console.error("recruitment call-token error", error);
    return NextResponse.json({ error: "Could not call this recruit" }, { status: 500 });
  }
}
