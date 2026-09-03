import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { buildRecruitProfiles } from "../[id]/queue/route";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/panels/waiting-by-domain?sub_domain=X
//
// Added 2026-09-03 alongside the queue-route crash fix in ../[id]/queue, then simplified
// the same day once check-in stopped auto-routing to a specific table (migration 024): a
// `waiting` token now has no panel_id at all - everyone waiting for a domain sits in ONE
// shared pool until a table actually calls them. This is that pool: every `waiting` token
// for one sub_domain, oldest check-in first, so any open table can see the whole domain's
// line and pull a specific recruit over via POST .../panels/:id/call-token (or just Call
// Next, which claims the front of this same pool automatically).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sub_domain = new URL(request.url).searchParams.get("sub_domain");
  if (!isRecruitSubDomain(sub_domain)) {
    return NextResponse.json({ error: "sub_domain must be a valid recruitment domain" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
  }

  // sub_domain is denormalized onto tokens (migration 004), so this is one filter, no join.
  const { data: tokens, error: tokensError } = await supabase
    .from("recruit_interview_tokens")
    .select(
      "id, token_number, checked_in_at, is_walkin, recruit_id, review_note, rating, interested_other_clubs, interested_other_domains, review_updated_by, review_updated_at"
    )
    .eq("cycle_id", cycleId)
    .eq("sub_domain", sub_domain)
    .eq("status", "waiting")
    .order("checked_in_at", { ascending: true });

  if (tokensError) {
    console.error("waiting-by-domain GET tokens error", tokensError);
    return NextResponse.json({ error: "Could not load waiting list" }, { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const recruitIds = Array.from(new Set(tokens.map((t: any) => t.recruit_id as string)));
  const profiles = await buildRecruitProfiles(supabase, recruitIds);
  const reviewerNames = await resolveDisplayNames(
    supabase,
    tokens.map((t: any) => t.review_updated_by)
  );

  const data = tokens.map((t: any) => ({
    token_id: t.id,
    token_number: t.token_number,
    checked_in_at: t.checked_in_at,
    is_walkin: Boolean(t.is_walkin),
    recruit: profiles.get(t.recruit_id) ?? null,
    // Included so a review already written while someone was waiting (rare, but possible -
    // a walk-in interview cycle can bounce a recruit back to waiting) isn't shown blank and
    // then clobbered by an unrelated save from this expanded view.
    review_note: t.review_note ?? null,
    rating: t.rating ?? null,
    interested_other_clubs: t.interested_other_clubs ?? null,
    interested_other_domains: t.interested_other_domains ?? null,
    review_updated_by: t.review_updated_by ? reviewerNames.get(t.review_updated_by) ?? t.review_updated_by : null,
    review_updated_at: t.review_updated_at ?? null,
  }));

  return NextResponse.json({ data });
}
