import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// Postgres unique_violation. Raised by the partial unique index
// `recruitment_cycles_single_active` (supabase/recruit-migration-002-cycles-training.sql)
// when two requests race to activate a cycle at the same time.
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

// GET /api/admin/recruitment/cycles - list all cycles (lead or admin), each with a
// total_recruits count (recruit_accounts rows for that cycle).
export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: cycles, error } = await supabase
    .from("recruitment_cycles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("recruitment cycles list error", error);
    return NextResponse.json({ success: false, error: "Could not load cycles." }, { status: 500 });
  }

  const withCounts = await Promise.all(
    (cycles || []).map(async (cycle: any) => {
      const { count } = await supabase
        .from("recruit_accounts")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", cycle.id);
      return { ...cycle, total_recruits: count ?? 0 };
    })
  );

  return NextResponse.json({ success: true, data: withCounts });
}

// POST /api/admin/recruitment/cycles - create a new cycle. Admin only (leads can view but
// not create/close/activate cycles).
//
// The old implementation deactivated every cycle FIRST and then inserted the new one, so a
// failing insert left the module with ZERO active cycles (every `.single()` active-cycle
// lookup 500s) with no way back except manual SQL. Order is now inverted: insert inactive,
// then hand over. A failure at any later step leaves the previous active cycle untouched or
// the new cycle sitting inactive - both recoverable from the UI's Activate button.
//
// "At most one active cycle" is now also a DB invariant (partial unique index), so a
// concurrent double-create can no longer produce two active cycles.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden - admin only." }, { status: 403 });
  }

  let body: { name?: string; year?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const year = (body.year || "").trim();
  if (!name || !year) {
    return NextResponse.json({ success: false, error: "name and year are required." }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  // 1. Create the cycle inactive. If this fails, nothing else has changed yet.
  const { data: created, error: insertError } = await supabase
    .from("recruitment_cycles")
    .insert({ name, year, is_active: false })
    .select("*")
    .single();

  if (insertError || !created) {
    console.error("recruitment cycles create error", insertError);
    return NextResponse.json({ success: false, error: "Could not create cycle." }, { status: 500 });
  }

  // 2. Stand the current cycle down.
  const { error: deactivateError } = await supabase
    .from("recruitment_cycles")
    .update({ is_active: false })
    .eq("is_active", true);

  if (deactivateError) {
    console.error("recruitment cycles deactivate error", deactivateError);
    return NextResponse.json({
      success: true,
      data: { ...created, total_recruits: 0 },
      warning:
        "Cycle created but the previous cycle could not be stood down, so this one is not active yet. Use Activate to retry.",
    });
  }

  // 3. Hand over to the new cycle.
  const { data: activated, error: activateError } = await supabase
    .from("recruitment_cycles")
    .update({ is_active: true })
    .eq("id", created.id)
    .select("*")
    .single();

  if (activateError || !activated) {
    console.error("recruitment cycles activate-on-create error", activateError);
    return NextResponse.json({
      success: true,
      data: { ...created, total_recruits: 0 },
      warning: isUniqueViolation(activateError)
        ? "Cycle created, but another cycle is already active. Use Activate on this cycle to take over."
        : "Cycle created but could not be activated. Use Activate to retry.",
    });
  }

  return NextResponse.json({ success: true, data: { ...activated, total_recruits: 0 } });
}
