import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { buildRecruitProfiles } from "../../panels/[id]/queue/route";
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

// GET /api/admin/recruitment/interview-results/recruit-detail?recruit_id=X&sub_domain=Y
//
// New 2026-09-04, for the Interview Results list's "edit on the spot" modal: clicking a
// recruit's name there used to navigate to their panel (RecruitProfileCard already lived on
// that page); now it opens RecruitProfileCard directly over a blurred backdrop instead, so
// this fetches everything that card needs (full profile + review fields + token_id to save
// against) for exactly one recruit, on demand - cheaper than adding all of that to every row
// of the results list, most of which never get clicked.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const recruitId = url.searchParams.get("recruit_id");
  const subDomain = url.searchParams.get("sub_domain");
  if (!recruitId) {
    return NextResponse.json({ error: "recruit_id is required" }, { status: 400 });
  }
  if (!isRecruitSubDomain(subDomain)) {
    return NextResponse.json({ error: "sub_domain must be a valid recruitment domain" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
  }

  // One row expected - a recruit checks in at most once per (cycle, domain). Not scoped to a
  // status: a `done` token (the normal case for anyone with a logged result) is still the
  // right row to attach the review to, same as `waiting`/`called`.
  const { data: token, error: tokenError } = await supabase
    .from("recruit_interview_tokens")
    .select(
      "id, token_number, is_walkin, review_note, rating, interested_other_clubs, interested_other_domains, review_updated_by, review_updated_at"
    )
    .eq("cycle_id", cycleId)
    .eq("recruit_id", recruitId)
    .eq("sub_domain", subDomain)
    .maybeSingle();

  if (tokenError) {
    console.error("interview-results recruit-detail GET token error", tokenError);
    return NextResponse.json({ error: "Could not load recruit" }, { status: 500 });
  }
  if (!token) {
    return NextResponse.json({ error: "No interview token found for this recruit and domain" }, { status: 404 });
  }

  const [profiles, reviewerNames] = await Promise.all([
    buildRecruitProfiles(supabase, [recruitId]),
    resolveDisplayNames(supabase, [token.review_updated_by]),
  ]);
  const recruit = profiles.get(recruitId);
  if (!recruit) {
    return NextResponse.json({ error: "Recruit not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      token_id: token.id,
      token_number: token.token_number,
      is_walkin: Boolean(token.is_walkin),
      recruit,
      review_note: token.review_note ?? null,
      rating: token.rating ?? null,
      interested_other_clubs: token.interested_other_clubs ?? null,
      interested_other_domains: token.interested_other_domains ?? null,
      review_updated_by: token.review_updated_by
        ? reviewerNames.get(token.review_updated_by) ?? token.review_updated_by
        : null,
      review_updated_at: token.review_updated_at ?? null,
    },
  });
}
