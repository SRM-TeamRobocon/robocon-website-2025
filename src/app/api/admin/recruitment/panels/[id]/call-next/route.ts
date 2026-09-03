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

// Postgres unique_violation - fired by the (panel_id, token_number) backstop when this
// route's freshly-computed token_number collides with a concurrent claim onto this panel.
const UNIQUE_VIOLATION = "23505";

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
// 2026-09-03: recruits no longer get auto-routed to a specific table at check-in (migration
// 024) - they sit in ONE shared `waiting` pool per domain (panel_id null). Call Next now
// claims the OLDEST token in THIS panel's domain pool (checked_in_at ASC - fairness across
// the whole line, not a per-panel order any more) and assigns it to this panel in the same
// update, allocating a fresh table-scoped token_number/queue_position exactly like a manual
// cross-table call (call-token) already does. Returns the same token+recruit shape as GET
// .../queue. Returns { status: 'queue_empty' } when nothing is waiting anywhere for this
// domain.
//
// Concurrency: "one called recruit per panel" used to exist only in the dashboard UI, which
// learns about state through a 5s poll. Two devices on the same panel (or one impatient
// double-click) both read the same oldest waiting token and both updated it by id with no
// status guard - two students called at once, and since the dashboard only renders the FIRST
// `called` token, Call Next stayed disabled forever and the panel jammed. Guards, now three:
//
//   1. Idempotency - if a `called` token already exists for this panel, return it instead of
//      calling anyone else. A second click/device gets the same recruit back, not a new one.
//   2. Compare-and-swap - the claiming update is conditioned on `.eq("status", "waiting")`,
//      so only one concurrent request (another table's Call Next, or a manual Call Here
//      targeting the same recruit) can win. The loser gets zero rows back and retries with
//      the next-oldest candidate.
//   3. Table-scoped token_number allocation retries on a (panel_id, token_number) collision,
//      same as call-token's cross-panel branch - two concurrent claims landing on THIS same
//      panel at once shouldn't both grab the same number.
export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createRecruitSupabaseAdminClient();

  const { data: panel, error: panelError } = await supabase
    .from("recruit_interview_panels")
    .select("id, sub_domain, is_active")
    .eq("id", id)
    .maybeSingle();

  if (panelError) {
    console.error("call-next: panel lookup error", panelError);
    return NextResponse.json({ error: "Could not call the next recruit" }, { status: 500 });
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

    // Walk forward through this DOMAIN's shared waiting pool (checked_in_at ASC - fairness
    // across whoever's been waiting longest, not a per-panel order any more, since a
    // never-yet-called token has no panel to be ordered within), excluding ids already
    // tried this request rather than re-reading the same one.
    const triedIds: string[] = [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let query = supabase
        .from("recruit_interview_tokens")
        .select(TOKEN_COLUMNS)
        .is("panel_id", null)
        .eq("sub_domain", panel.sub_domain)
        .eq("status", "waiting")
        .order("checked_in_at", { ascending: true, nullsFirst: true })
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

      // Claiming this token means assigning it to THIS panel for the first time - allocate a
      // fresh, table-scoped token_number/queue_position in the same update, same pattern as
      // call-token's cross-panel reassignment.
      const [{ data: maxTokenRow }, { data: maxPositionRow }] = await Promise.all([
        supabase
          .from("recruit_interview_tokens")
          .select("token_number")
          .eq("panel_id", id)
          .order("token_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("recruit_interview_tokens")
          .select("queue_position")
          .eq("panel_id", id)
          .order("queue_position", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const nextTokenNumber = (maxTokenRow?.token_number ?? 0) + 1;
      const nextQueuePosition = (maxPositionRow?.queue_position ?? 0) + 1000;

      const { data: updated, error: updateError } = await supabase
        .from("recruit_interview_tokens")
        .update({
          panel_id: id,
          token_number: nextTokenNumber,
          queue_position: nextQueuePosition,
          status: "called",
          called_at: new Date().toISOString(),
        })
        .eq("id", next.id)
        .eq("status", "waiting")
        .select(TOKEN_COLUMNS)
        .maybeSingle();

      if (!updateError) {
        if (updated) {
          return await respond(updated as TokenRow, false);
        }
        // Zero rows updated => somebody else claimed this exact token between our read and
        // our write (another table's Call Next, or a manual Call Here). If they called it to
        // THIS panel, hand back their token (idempotent); otherwise move on to the next
        // candidate - it went to a different table.
        const raced = await findCalled();
        if (raced) {
          return await respond(raced, true);
        }
        triedIds.push(next.id);
        continue;
      }

      if (updateError.code !== UNIQUE_VIOLATION) {
        throw new Error(updateError.message);
      }
      // A concurrent claim landed the same token_number on THIS panel between our read and
      // write. The candidate itself is still a valid, unclaimed recruit - simplest safe
      // retry is to move on to the next-oldest one rather than recomputing the same number,
      // at the cost of (rare, contention-only) strict FIFO order.
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
