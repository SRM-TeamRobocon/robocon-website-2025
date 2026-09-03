import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain, subDomainFullLabel } from "@/lib/recruit-domains";
import { travelMethodLabel } from "@/lib/travel-method";
import { genderLabel } from "@/lib/gender";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvResponse(rows: string[][], filename: string) {
  const lines = [HEADER, ...rows].map((row) => row.map(csvCell).join(","));
  const csv = lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const HEADER = [
  "Name",
  "Reg No",
  "Year",
  "Gender",
  "Department",
  "Course",
  "Phone",
  "Hostel",
  "Block",
  "Room",
  "Area",
  "Travel Method",
  "Domain",
  "Marks",
  "Token Status",
  "Walk-in",
  "Checked In At",
  "Called At",
  "Result",
  "Result Notes",
  "Review Note",
  "Reviewed By",
  "Reviewed At",
];

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/interview-results/export?sub_domain=coding
// CSV of everyone checked in for THIS domain's interview - the roster, not just those with
// a logged result, so it also captures who is still waiting/called/no-show, their marks,
// and any review note a panel has already written (see migration 022). Scoped to one
// domain at a time, matching the tab a lead has open on /dashboard/recruitment/interview -
// exporting all six at once would mix table numbers/statuses that only make sense per
// domain and force a lead to filter it back out in a spreadsheet anyway.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const sub_domain = new URL(request.url).searchParams.get("sub_domain");
  if (!isRecruitSubDomain(sub_domain)) {
    return NextResponse.json(
      { success: false, error: "sub_domain must be a valid recruitment domain" },
      { status: 400 }
    );
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  // Tokens carry a denormalized sub_domain (migration 004), so this is a single filter
  // rather than joining through panels - and it survives a cross-panel reassignment,
  // since that updates panel_id in place on the same token row rather than inserting a
  // new one for a different panel.
  const { data: tokens, error: tokensError } = await supabase
    .from("recruit_interview_tokens")
    .select(
      "id, recruit_id, status, is_walkin, checked_in_at, called_at, review_note, review_updated_by, review_updated_at"
    )
    .eq("cycle_id", cycleId)
    .eq("sub_domain", sub_domain)
    .order("checked_in_at", { ascending: true });

  if (tokensError) {
    console.error("interview-results export tokens error", tokensError);
    return NextResponse.json({ success: false, error: "Could not load interview roster" }, { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    return csvResponse([], `interview-${sub_domain}.csv`);
  }

  const recruitIds = Array.from(new Set(tokens.map((t) => t.recruit_id)));

  const [{ data: accounts }, { data: marksRows }, { data: results }] = await Promise.all([
    supabase
      .from("recruit_accounts")
      .select(
        "id, name, reg_no, year, gender, department, course, phone, is_hosteller, hostel_block, hostel_room, day_scholar_area, travel_method"
      )
      .in("id", recruitIds),
    supabase.from("recruit_marks").select("recruit_id, marks").eq("cycle_id", cycleId).eq("sub_domain", sub_domain).in("recruit_id", recruitIds),
    supabase
      .from("recruit_interview_results")
      .select("recruit_id, result, notes")
      .eq("cycle_id", cycleId)
      .eq("sub_domain", sub_domain)
      .in("recruit_id", recruitIds),
  ]);

  const accountById = new Map((accounts ?? []).map((a: any) => [a.id, a]));
  const marksByRecruit = new Map((marksRows ?? []).map((m: any) => [m.recruit_id, m.marks]));
  const resultByRecruit = new Map((results ?? []).map((r: any) => [r.recruit_id, r]));
  const reviewerNames = await resolveDisplayNames(
    supabase,
    tokens.map((t: any) => t.review_updated_by)
  );

  const domainLabel = subDomainFullLabel(sub_domain);

  const rows = tokens.map((t: any) => {
    const acc = accountById.get(t.recruit_id);
    const marks = marksByRecruit.get(t.recruit_id);
    const result = resultByRecruit.get(t.recruit_id);
    return [
      acc?.name ?? "",
      acc?.reg_no ?? "",
      acc?.year ?? "",
      genderLabel(acc?.gender) || "",
      acc?.department ?? "",
      acc?.course ?? "",
      acc?.phone ?? "",
      acc?.is_hosteller ? "Hosteller" : "Day Scholar",
      acc?.is_hosteller ? acc?.hostel_block ?? "" : "",
      acc?.is_hosteller ? acc?.hostel_room ?? "" : "",
      acc?.is_hosteller ? "" : acc?.day_scholar_area ?? "",
      acc?.is_hosteller ? "" : travelMethodLabel(acc?.travel_method) || "",
      domainLabel,
      marks === undefined || marks === null ? "" : Number(marks),
      t.status,
      t.is_walkin ? "Yes" : "No",
      t.checked_in_at ?? "",
      t.called_at ?? "",
      result?.result ?? "",
      result?.notes ?? "",
      t.review_note ?? "",
      t.review_updated_by ? reviewerNames.get(t.review_updated_by) ?? t.review_updated_by : "",
      t.review_updated_at ?? "",
    ];
  });

  return csvResponse(rows, `interview-${sub_domain}.csv`);
}
