import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { fetchAllRows, selectInChunks } from "@/lib/supabase/query-helpers";
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

// GET /api/admin/recruitment/marks?domain=coding&cycle_id=<optional, defaults to active cycle>
// Returns every recruit who selected `domain`, with existing marks (if any) and exam
// attendance status (day 1 / day 2 booleans). Not filtered by attendance — see
// 06-EXAM-AND-SHORTLISTING.md: "Marks entry is NOT gated by exam attendance."
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!isRecruitSubDomain(domain)) {
    return NextResponse.json(
      { success: false, error: "domain must be a valid recruitment domain" },
      { status: 400 }
    );
  }

  const supabase = createRecruitSupabaseAdminClient();

  const cycleId = searchParams.get("cycle_id") || (await getActiveCycleId(supabase));
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  // A single popular domain (e.g. "coding") can plausibly clear 1000 selections on its own
  // at the module's 2000-recruit target scale, so this pages rather than trust one fetch.
  type SelectionRow = { recruit_id: string; recruit_accounts: unknown };
  const { data: rows, error: selectionsError } = await fetchAllRows<SelectionRow>((from, to) =>
    supabase
      .from("recruit_domain_selections")
      .select("recruit_id, recruit_accounts(id, name, reg_no, year, department, course)")
      .eq("cycle_id", cycleId)
      .eq("sub_domain", domain)
      .range(from, to)
  );

  if (selectionsError) {
    console.error("recruitment marks GET selections error", selectionsError);
    return NextResponse.json({ success: false, error: "Could not load recruits" }, { status: 500 });
  }

  // Supabase's untyped client can't confirm this is a to-one relationship, so it may type
  // recruit_accounts as an array even though recruit_domain_selections.recruit_id -> recruit_accounts.id
  // is many-to-one. Normalize defensively either way.
  const accountOf = (row: SelectionRow): { id: string; name: string; reg_no: string; year: string; department: string; course: string } | null =>
    (Array.isArray(row.recruit_accounts) ? row.recruit_accounts[0] : row.recruit_accounts) as any;
  const recruitIds = rows.map((r) => r.recruit_id);

  if (recruitIds.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const [{ data: marksRows, error: marksError }, { data: attendanceRows, error: attendanceError }] = await Promise.all([
    selectInChunks(recruitIds, (chunk) =>
      supabase
        .from("recruit_marks")
        .select("recruit_id, marks, evaluator_username, updated_at, entered_at")
        .eq("cycle_id", cycleId)
        .eq("sub_domain", domain)
        .in("recruit_id", chunk)
    ),
    // Scoped to this sub_domain: attendance is per-exam, so the Day 1/Day 2 ticks
    // reflect whether they sat THIS domain's exam — not some other domain's.
    selectInChunks(recruitIds, (chunk) =>
      supabase
        .from("recruit_exam_attendance")
        .select("recruit_id, day")
        .eq("cycle_id", cycleId)
        .eq("sub_domain", domain)
        .in("recruit_id", chunk)
    ),
  ]);

  if (marksError || attendanceError) {
    console.error("recruitment marks GET marks/attendance error", marksError || attendanceError);
    return NextResponse.json({ success: false, error: "Could not load marks" }, { status: 500 });
  }

  const marksMap = new Map(
    (marksRows ?? []).map((m: any) => [m.recruit_id, m])
  );
  const attendanceMap = new Map<string, { day1: boolean; day2: boolean }>();
  for (const a of (attendanceRows ?? []) as Array<{ recruit_id: string; day: number }>) {
    const entry = attendanceMap.get(a.recruit_id) ?? { day1: false, day2: false };
    if (a.day === 1) entry.day1 = true;
    if (a.day === 2) entry.day2 = true;
    attendanceMap.set(a.recruit_id, entry);
  }

  const evaluatorNames = await resolveDisplayNames(
    supabase,
    (marksRows ?? []).map((m: any) => m.evaluator_username)
  );

  const data = rows
    .map((r) => ({ r, acc: accountOf(r) }))
    .filter((x): x is { r: SelectionRow; acc: NonNullable<ReturnType<typeof accountOf>> } => x.acc !== null)
    .map(({ r, acc }) => {
      const marks = marksMap.get(r.recruit_id) as
        | { marks: number; evaluator_username: string; updated_at: string | null; entered_at: string | null }
        | undefined;
      const attendance = attendanceMap.get(r.recruit_id) ?? { day1: false, day2: false };
      return {
        recruit_id: acc.id,
        name: acc.name,
        reg_no: acc.reg_no,
        year: acc.year,
        department: acc.department,
        course: acc.course,
        day1: attendance.day1,
        day2: attendance.day2,
        marks: marks?.marks ?? null,
        evaluator_username: marks?.evaluator_username ? evaluatorNames.get(marks.evaluator_username) ?? marks.evaluator_username : null,
        updated_at: marks?.updated_at ?? marks?.entered_at ?? null,
      };
    });

  return NextResponse.json({ success: true, data, cycle_id: cycleId });
}

// POST /api/admin/recruitment/marks — upsert a single recruit's marks for a sub_domain.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const recruit_id = typeof body?.recruit_id === "string" ? body.recruit_id : null;
  const sub_domain = body?.sub_domain;
  const marksRaw = body?.marks;

  if (!recruit_id) {
    return NextResponse.json({ success: false, error: "recruit_id is required" }, { status: 400 });
  }

  if (!isRecruitSubDomain(sub_domain)) {
    return NextResponse.json(
      { success: false, error: "sub_domain must be a valid recruitment domain" },
      { status: 400 }
    );
  }

  const marks = typeof marksRaw === "number" ? marksRaw : Number(marksRaw);
  if (!Number.isInteger(marks) || marks < 0 || marks > 100) {
    return NextResponse.json({ success: false, error: "marks must be an integer between 0 and 100" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  const { data: selection, error: selectionError } = await supabase
    .from("recruit_domain_selections")
    .select("id")
    .eq("recruit_id", recruit_id)
    .eq("sub_domain", sub_domain)
    .eq("cycle_id", cycleId)
    .maybeSingle();

  if (selectionError) {
    console.error("recruitment marks POST selection lookup error", selectionError);
    return NextResponse.json({ success: false, error: "Could not verify domain selection" }, { status: 500 });
  }

  if (!selection) {
    return NextResponse.json(
      { success: false, error: "Recruit did not select this sub_domain" },
      { status: 400 }
    );
  }

  const updatedAt = new Date().toISOString();

  const { error: upsertError } = await supabase.from("recruit_marks").upsert(
    {
      cycle_id: cycleId,
      recruit_id,
      sub_domain,
      marks,
      evaluator_username: session.user,
      updated_at: updatedAt,
    },
    { onConflict: "recruit_id,sub_domain,cycle_id" }
  );

  if (upsertError) {
    console.error("recruitment marks POST upsert error", upsertError);
    return NextResponse.json({ success: false, error: "Could not save marks" }, { status: 500 });
  }

  // Echo back who saved it and when, resolved the same way the GET does. Without this the
  // marks page would show a stale (or missing) "Saved by ..." line until a full reload —
  // the one moment an evaluator most wants to see their own entry confirmed.
  const evaluatorNames = await resolveDisplayNames(supabase, [session.user]);

  return NextResponse.json({
    saved: true,
    recruit_id,
    sub_domain,
    marks,
    evaluator_username: evaluatorNames.get(session.user) ?? session.user,
    updated_at: updatedAt,
  });
}
