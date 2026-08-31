import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { RECRUIT_SUBDOMAIN_KEYS } from "@/lib/recruit-domains";
import { fetchAllRows, recruitSearchOrFilter, selectInChunks } from "@/lib/supabase/query-helpers";

export const dynamic = "force-dynamic";

const VALID_DOMAINS = RECRUIT_SUBDOMAIN_KEYS as string[];

// Departments are free text on recruit_accounts, so the filter can't be validated against
// an enum — bound its length instead so it can't be used to push arbitrarily large strings
// into a query.
const MAX_DEPARTMENT_LENGTH = 120;

// GET /api/admin/recruitment/recruits — list recruits for the active cycle.
// Query params: domain, year, department (exact match), search (name or reg_no
// case-insensitive, or phone — see recruitSearchOrFilter for how the one term is normalized
// differently per column). Phone is searchable here but is NOT newly surfaced in any UI.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain")?.trim() || "";
  const year = searchParams.get("year")?.trim() || "";
  const department = searchParams.get("department")?.trim() || "";
  const search = searchParams.get("search")?.trim() || "";

  if (domain && !VALID_DOMAINS.includes(domain)) {
    return NextResponse.json({ success: false, error: "Invalid domain." }, { status: 400 });
  }
  if (department.length > MAX_DEPARTMENT_LENGTH) {
    return NextResponse.json({ success: false, error: "Invalid department." }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id, name, year")
    .eq("is_active", true)
    .single();

  if (!cycle) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }
  const cycleId = cycle.id;

  // Unbounded by recruit count — a popular domain at 2000 total registrants can plausibly
  // clear PostgREST's default 1000-row response cap on its own, so this pages too.
  let recruitIdFilter: string[] | null = null;
  if (domain) {
    const { data: selections, error: selError } = await fetchAllRows<{ recruit_id: string }>((from, to) =>
      supabase
        .from("recruit_domain_selections")
        .select("recruit_id")
        .eq("cycle_id", cycleId)
        .eq("sub_domain", domain)
        .range(from, to)
    );

    if (selError) {
      console.error("recruits domain filter error", selError);
      return NextResponse.json({ success: false, error: "Could not filter by domain." }, { status: 500 });
    }
    recruitIdFilter = Array.from(new Set(selections.map((s) => s.recruit_id)));
    if (recruitIdFilter.length === 0) {
      return NextResponse.json({ success: true, cycle, data: [] });
    }
  }

  const searchOrFilter = recruitSearchOrFilter(search);

  function buildRecruitsQuery(from: number, to: number) {
    let query = supabase
      .from("recruit_accounts")
      .select(
        "id, name, reg_no, year, gender, department, course, srm_email, phone, is_hosteller, hostel_block, hostel_room, day_scholar_area, travel_method, is_selected, created_at"
      )
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: false });

    if (year) query = query.eq("year", year);
    if (department) query = query.eq("department", department);
    if (recruitIdFilter) query = query.in("id", recruitIdFilter);
    if (searchOrFilter) query = query.or(searchOrFilter);
    return query.range(from, to);
  }

  const { data: recruits, error: recruitsError } = await fetchAllRows<any>(buildRecruitsQuery);
  if (recruitsError) {
    console.error("recruits list error", recruitsError);
    return NextResponse.json({ success: false, error: "Could not load recruits." }, { status: 500 });
  }

  const recruitIds = recruits.map((r) => r.id as string);
  if (recruitIds.length === 0) {
    return NextResponse.json({ success: true, cycle, data: [] });
  }

  const [selectionsRes, orientationRes, examRes] = await Promise.all([
    selectInChunks<{ recruit_id: string; sub_domain: string }>(recruitIds, (chunk) =>
      supabase.from("recruit_domain_selections").select("recruit_id, sub_domain").eq("cycle_id", cycleId).in("recruit_id", chunk)
    ),
    selectInChunks<{ recruit_id: string }>(recruitIds, (chunk) =>
      supabase.from("recruit_orientation_attendance").select("recruit_id").eq("cycle_id", cycleId).in("recruit_id", chunk)
    ),
    // Exam attendance is keyed (recruit_id, cycle_id, sub_domain) — a recruit sitting two
    // domain exams has one row each, so the day flags alone can't tell you WHICH exam they
    // actually sat. Return the per-domain rows too.
    selectInChunks<{ recruit_id: string; day: number; sub_domain: string }>(recruitIds, (chunk) =>
      supabase.from("recruit_exam_attendance").select("recruit_id, day, sub_domain").eq("cycle_id", cycleId).in("recruit_id", chunk)
    ),
  ]);

  const domainsByRecruit = new Map<string, string[]>();
  (selectionsRes.data || []).forEach((row: any) => {
    const list = domainsByRecruit.get(row.recruit_id) || [];
    list.push(row.sub_domain);
    domainsByRecruit.set(row.recruit_id, list);
  });

  const orientationSet = new Set((orientationRes.data || []).map((row: any) => row.recruit_id));
  const examDaySet = new Set((examRes.data || []).map((row: any) => `${row.recruit_id}:${row.day}`));

  const examsByRecruit = new Map<string, { sub_domain: string; day: number }[]>();
  (examRes.data || []).forEach((row: any) => {
    const list = examsByRecruit.get(row.recruit_id) || [];
    list.push({ sub_domain: row.sub_domain, day: row.day });
    examsByRecruit.set(row.recruit_id, list);
  });

  const data = (recruits || []).map((r: any) => ({
    ...r,
    domains: domainsByRecruit.get(r.id) || [],
    orientation: orientationSet.has(r.id),
    exams: examsByRecruit.get(r.id) || [],
    // Legacy day flags. Nothing reads these any more — the roster renders `exams` instead,
    // and the CSV export runs its own query. Don't reach for them in new code: they say
    // "showed up on some day" without saying WHICH exam, which is meaningless for a recruit
    // who applied to two domains.
    exam_day1: examDaySet.has(`${r.id}:1`),
    exam_day2: examDaySet.has(`${r.id}:2`),
  }));

  return NextResponse.json({ success: true, cycle, data });
}
