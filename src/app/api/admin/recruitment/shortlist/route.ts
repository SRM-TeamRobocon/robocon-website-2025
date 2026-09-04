import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { fetchAllRows, selectInChunks } from "@/lib/supabase/query-helpers";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "shortlisted", "not_shortlisted"] as const;

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/shortlist?domain=&status=
// Returns all recruit_shortlist_status rows for the active cycle, joined with recruit
// name/reg_no/year/gender/department/portfolio_url/residence and their marks. Residence
// fields (is_hosteller/hostel_block/hostel_room/day_scholar_area/travel_method) feed the
// page's residence-breakdown panel and the per-row "Residence" detail field.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const domainParam = searchParams.get("domain");
  const statusParam = searchParams.get("status");

  if (domainParam && !isRecruitSubDomain(domainParam)) {
    return NextResponse.json({ success: false, error: "Invalid domain" }, { status: 400 });
  }
  if (statusParam && !(STATUSES as readonly string[]).includes(statusParam)) {
    return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  // Unfiltered ("all domains") this can span every domain's shortlist rows at once - at
  // the module's 2000-recruit target scale that's comfortably past PostgREST's default
  // 1000-row response cap, so page through it.
  const { data: rows, error } = await fetchAllRows<any>((from, to) => {
    let query = supabase
      .from("recruit_shortlist_status")
      .select(
        "id, recruit_id, sub_domain, status, method, override_reason, overridden_by, overridden_at, computed_at, called_by, called_at, recruit_accounts(id, name, reg_no, year, gender, department, course, portfolio_url, phone, is_hosteller, hostel_block, hostel_room, day_scholar_area, travel_method)"
      )
      .eq("cycle_id", cycleId)
      .order("sub_domain", { ascending: true });

    if (domainParam) query = query.eq("sub_domain", domainParam);
    if (statusParam) query = query.eq("status", statusParam);

    return query.range(from, to);
  });

  if (error) {
    console.error("shortlist GET error", error);
    return NextResponse.json({ success: false, error: "Could not load shortlist" }, { status: 500 });
  }

  const rowRecruitIds = rows.map((r) => r.recruit_id as string);

  // marksResult, calledByNames and interviewResult each only depend on rows/rowRecruitIds,
  // not on each other - running them concurrently makes this route's latency roughly the
  // slowest of the three round trips instead of the sum of all three. (selectInChunks
  // already short-circuits to an empty result with no network call when rowRecruitIds is
  // empty, so the old `if (rowRecruitIds.length > 0)` guards around two of these were
  // redundant once written this way.)
  const [marksResult, calledByNames, interviewResult] = await Promise.all([
    selectInChunks<{
      recruit_id: string;
      sub_domain: string;
      marks: number | string | null;
    }>(rowRecruitIds, (chunk) =>
      supabase.from("recruit_marks").select("recruit_id, sub_domain, marks").eq("cycle_id", cycleId).in("recruit_id", chunk)
    ),
    resolveDisplayNames(supabase, rows.map((r) => r.called_by)),
    selectInChunks<{
      recruit_id: string;
      sub_domain: string;
      result: string;
      notes: string | null;
      interviewer_username: string;
      decided_at: string | null;
    }>(rowRecruitIds, (chunk) =>
      supabase
        .from("recruit_interview_results")
        .select("recruit_id, sub_domain, result, notes, interviewer_username, decided_at")
        .eq("cycle_id", cycleId)
        .in("recruit_id", chunk)
    ),
  ]);

  if (marksResult.error) {
    console.error("shortlist GET marks error", marksResult.error);
    return NextResponse.json({ success: false, error: "Could not load marks" }, { status: 500 });
  }
  if (interviewResult.error) {
    console.error("shortlist GET interview results error", interviewResult.error);
    return NextResponse.json({ success: false, error: "Could not load interview results" }, { status: 500 });
  }

  // `marks` is numeric(5,2) since migration 020 and this client is untyped, so PostgREST
  // may hand it over as the string "72.50". Coerce so the row ships a real number (and
  // renders as "72.5", not "72.50"). A stored null stays null - combined with the `?? null`
  // below, a recruit with no marks row still reports null rather than 0.
  const marksMap = new Map(
    marksResult.data.map((m) => [`${m.recruit_id}:${m.sub_domain}`, m.marks === null ? null : Number(m.marks)])
  );

  // Supabase's untyped client can't confirm this is a to-one relationship, so it may type
  // recruit_accounts as an array even though recruit_shortlist_status.recruit_id -> recruit_accounts.id
  // is many-to-one. Normalize defensively either way.
  const accountOf = (row: any): any => (Array.isArray(row.recruit_accounts) ? row.recruit_accounts[0] : row.recruit_accounts);

  // Interview outcome per (recruit, sub_domain) - a recruit_interview_results row only
  // exists once a panel has logged selected/rejected/waitlisted for them, so its presence
  // IS "interview done"; there is no separate boolean to maintain. Keyed the same way as
  // marksMap above since both join back to this row's (recruit_id, sub_domain) pair.
  const interviewMap = new Map(interviewResult.data.map((i) => [`${i.recruit_id}:${i.sub_domain}`, i]));

  // Depends on interviewMap (needs the interviewer usernames it resolved), so this one
  // can't join the Promise.all above - it's the only genuinely sequential step left.
  const interviewerNames = await resolveDisplayNames(
    supabase,
    Array.from(interviewMap.values()).map((i) => i.interviewer_username)
  );

  const result = rows
    .map((r) => ({ r, acc: accountOf(r) }))
    .filter(({ acc }) => acc)
    .map(({ r, acc }) => {
      const interview = interviewMap.get(`${r.recruit_id}:${r.sub_domain}`) ?? null;
      return {
      id: r.id,
      recruit_id: r.recruit_id,
      sub_domain: r.sub_domain,
      status: r.status,
      method: r.method,
      override_reason: r.override_reason,
      overridden_by: r.overridden_by,
      overridden_at: r.overridden_at,
      computed_at: r.computed_at,
      called_by: r.called_by ? calledByNames.get(r.called_by) ?? r.called_by : null,
      called_at: r.called_at,
      marks: marksMap.get(`${r.recruit_id}:${r.sub_domain}`) ?? null,
      interview_result: interview?.result ?? null,
      interview_notes: interview?.notes ?? null,
      interview_decided_at: interview?.decided_at ?? null,
      interview_interviewer: interview
        ? interviewerNames.get(interview.interviewer_username) ?? interview.interviewer_username
        : null,
      recruit: {
        id: acc.id,
        name: acc.name,
        reg_no: acc.reg_no,
        year: acc.year,
        // Nullable on recruit_accounts - passed through as null rather than defaulted, so
        // the page's "All genders" option is the only thing that can show such a row.
        gender: acc.gender ?? null,
        department: acc.department,
        course: acc.course,
        portfolio_url: acc.portfolio_url,
        phone: acc.phone,
        is_hosteller: acc.is_hosteller,
        hostel_block: acc.hostel_block,
        hostel_room: acc.hostel_room,
        day_scholar_area: acc.day_scholar_area,
        travel_method: acc.travel_method,
      },
      };
    });

  return NextResponse.json({ success: true, data: result, cycle_id: cycleId });
}
