import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { fetchAllRows } from "@/lib/supabase/query-helpers";

export const dynamic = "force-dynamic";

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/interview-status?domain=
//
// One row per (recruit, sub_domain) shortlisted for interview, collapsed to a single
// status for the Send Mail page's "Interview Result" filter:
//   - selected / rejected / waitlisted - a recruit_interview_results row is logged
//   - no_show - checked in, called, never resolved with a result (token status no_show)
//   - in_progress - checked in but not yet resolved (waiting/called/done-without-a-result -
//     that last case is rare, e.g. a result deleted via the shortlist page's undo)
//   - not_yet - shortlisted, no recruit_interview_tokens row at all - never checked in,
//     same population as .../interview-results/yet-to-be-interviewed but for every domain
//     at once rather than one domain per call
// Domains where the recruit isn't shortlisted are left out entirely (nothing to report),
// same as the shortlist route's own status column when no row exists for that pair.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const domainParam = new URL(request.url).searchParams.get("domain");
  if (domainParam && !isRecruitSubDomain(domainParam)) {
    return NextResponse.json({ success: false, error: "Invalid domain" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  const [shortlistRes, tokensRes, resultsRes] = await Promise.all([
    fetchAllRows<{ recruit_id: string; sub_domain: string }>((from, to) => {
      let query = supabase
        .from("recruit_shortlist_status")
        .select("recruit_id, sub_domain")
        .eq("cycle_id", cycleId)
        .eq("status", "shortlisted");
      if (domainParam) query = query.eq("sub_domain", domainParam);
      return query.range(from, to);
    }),
    fetchAllRows<{ recruit_id: string; sub_domain: string; status: string }>((from, to) => {
      let query = supabase.from("recruit_interview_tokens").select("recruit_id, sub_domain, status").eq("cycle_id", cycleId);
      if (domainParam) query = query.eq("sub_domain", domainParam);
      return query.range(from, to);
    }),
    fetchAllRows<{ recruit_id: string; sub_domain: string; result: string }>((from, to) => {
      let query = supabase.from("recruit_interview_results").select("recruit_id, sub_domain, result").eq("cycle_id", cycleId);
      if (domainParam) query = query.eq("sub_domain", domainParam);
      return query.range(from, to);
    }),
  ]);

  const error = shortlistRes.error || tokensRes.error || resultsRes.error;
  if (error) {
    console.error("interview-status GET error", error);
    return NextResponse.json({ success: false, error: "Could not load interview status" }, { status: 500 });
  }

  const keyOf = (recruitId: string, subDomain: string) => `${recruitId}:${subDomain}`;
  const resultByKey = new Map(resultsRes.data.map((r) => [keyOf(r.recruit_id, r.sub_domain), r.result]));
  const tokenByKey = new Map(tokensRes.data.map((t) => [keyOf(t.recruit_id, t.sub_domain), t.status]));

  const data = shortlistRes.data.map((row) => {
    const key = keyOf(row.recruit_id, row.sub_domain);
    const result = resultByKey.get(key);
    const tokenStatus = tokenByKey.get(key);
    const status = result ?? (tokenStatus === "no_show" ? "no_show" : tokenStatus ? "in_progress" : "not_yet");
    return { recruit_id: row.recruit_id, sub_domain: row.sub_domain, status };
  });

  return NextResponse.json({ success: true, data });
}
