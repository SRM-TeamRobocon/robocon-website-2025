import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { RECRUIT_SUBDOMAIN_KEYS, subDomainFullLabel } from "@/lib/recruit-domains";
import { fetchAllRows, selectInChunks } from "@/lib/supabase/query-helpers";
import { travelMethodLabel } from "@/lib/travel-method";
import { genderLabel } from "@/lib/gender";

export const dynamic = "force-dynamic";

const VALID_DOMAINS = RECRUIT_SUBDOMAIN_KEYS as string[];

function escapeOrValue(input: string) {
  return input.replace(/[\\,()]/g, (c) => `\\${c}`);
}

function csvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const HEADER = [
  "Name",
  "Reg No",
  "Year",
  "Gender",
  "Department",
  "Course",
  "SRM Email",
  "Phone",
  "Hostel",
  "Block",
  "Room",
  "Area",
  "Travel Method",
  "Domain 1",
  "Domain 2",
  "Orientation",
  "Exam Day 1",
  "Exam Day 2",
];

function csvResponse(rows: string[][]) {
  const lines = [HEADER, ...rows].map((row) => row.map(csvCell).join(","));
  const csv = lines.join("\r\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="recruits.csv"',
    },
  });
}

// GET /api/admin/recruitment/recruits/export — CSV export of the same filtered/active-cycle
// dataset as the recruits list route. Query params: domain, year, search.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain")?.trim() || "";
  const year = searchParams.get("year")?.trim() || "";
  const search = searchParams.get("search")?.trim() || "";

  if (domain && !VALID_DOMAINS.includes(domain)) {
    return NextResponse.json({ success: false, error: "Invalid domain." }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .single();

  if (!cycle) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }
  const cycleId = cycle.id;

  // See recruits/route.ts (same shape, same reasoning): none of this is bounded by a small
  // ID list, so at the module's 1000-2000 recruit target scale it can exceed PostgREST's
  // silent 1000-row response cap. Page/chunk rather than risk a CSV export that's quietly
  // missing rows with no indication anything was cut off.
  let recruitIdFilter: string[] | null = null;
  if (domain) {
    const { data: selections, error: selError } = await fetchAllRows<{ recruit_id: string }>((from, to) =>
      supabase.from("recruit_domain_selections").select("recruit_id").eq("cycle_id", cycleId).eq("sub_domain", domain).range(from, to)
    );

    if (selError) {
      console.error("recruits export domain filter error", selError);
      return NextResponse.json({ success: false, error: "Could not filter by domain." }, { status: 500 });
    }
    recruitIdFilter = Array.from(new Set(selections.map((s) => s.recruit_id)));
    if (recruitIdFilter.length === 0) {
      return csvResponse([]);
    }
  }

  function buildExportQuery(from: number, to: number) {
    let query = supabase
      .from("recruit_accounts")
      .select(
        "id, name, reg_no, year, gender, department, course, srm_email, phone, is_hosteller, hostel_block, hostel_room, day_scholar_area, travel_method, created_at"
      )
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: false });

    if (year) query = query.eq("year", year);
    if (recruitIdFilter) query = query.in("id", recruitIdFilter);
    if (search) {
      const s = escapeOrValue(search);
      query = query.or(`name.ilike.%${s}%,reg_no.ilike.%${s}%`);
    }
    return query.range(from, to);
  }

  const { data: recruits, error } = await fetchAllRows<any>(buildExportQuery);
  if (error) {
    console.error("recruits export error", error);
    return NextResponse.json({ success: false, error: "Could not export recruits." }, { status: 500 });
  }

  const recruitIds = recruits.map((r) => r.id as string);
  if (recruitIds.length === 0) {
    return csvResponse([]);
  }

  const [selectionsRes, orientationRes, examRes] = await Promise.all([
    selectInChunks<{ recruit_id: string; sub_domain: string }>(recruitIds, (chunk) =>
      supabase
        .from("recruit_domain_selections")
        .select("recruit_id, sub_domain")
        .in("recruit_id", chunk)
        .order("created_at", { ascending: true })
    ),
    selectInChunks<{ recruit_id: string }>(recruitIds, (chunk) =>
      supabase.from("recruit_orientation_attendance").select("recruit_id").in("recruit_id", chunk)
    ),
    selectInChunks<{ recruit_id: string; day: number }>(recruitIds, (chunk) =>
      supabase.from("recruit_exam_attendance").select("recruit_id, day").in("recruit_id", chunk)
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

  const rows = (recruits || []).map((r: any) => {
    const domains = domainsByRecruit.get(r.id) || [];
    return [
      r.name,
      r.reg_no,
      r.year,
      genderLabel(r.gender),
      r.department,
      r.course,
      r.srm_email,
      r.phone || "",
      r.is_hosteller ? "Hosteller" : "Day Scholar",
      r.hostel_block || "",
      r.hostel_room || "",
      r.day_scholar_area || "",
      travelMethodLabel(r.travel_method),
      domains[0] ? subDomainFullLabel(domains[0]) : "",
      domains[1] ? subDomainFullLabel(domains[1]) : "",
      orientationSet.has(r.id) ? "Yes" : "No",
      examDaySet.has(`${r.id}:1`) ? "Yes" : "No",
      examDaySet.has(`${r.id}:2`) ? "Yes" : "No",
    ];
  });

  return csvResponse(rows);
}
