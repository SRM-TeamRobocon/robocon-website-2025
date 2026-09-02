import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/recruitment/panels/:id/reopen
// The inverse of ../close. Closing a panel is a normal end-of-slot action, but it also
// disables Call Next and makes the scanner refuse interview check-ins - so a panel closed
// while recruits were still `waiting` used to strand them permanently, fixable only by
// hand-editing is_active in SQL. Reopening flips is_active back to true; token rows are
// untouched (they were never mutated on close), so the queue resumes exactly where it was.
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  // Only reopen a panel in the currently active cycle - reviving a panel from a previous
  // recruitment season would put it back in the scanner's picker.
  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!cycle) {
    return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("recruit_interview_panels")
    .update({ is_active: true })
    .eq("id", id)
    .eq("cycle_id", cycle.id)
    .select("id, domain_label")
    .maybeSingle();

  if (error) {
    console.error("recruitment panel reopen error", error);
    return NextResponse.json({ error: "Could not reopen panel" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Panel not found in the active cycle" }, { status: 404 });
  }

  const { count: waitingLeft } = await supabase
    .from("recruit_interview_tokens")
    .select("id", { count: "exact", head: true })
    .eq("panel_id", id)
    .eq("status", "waiting");

  return NextResponse.json({ reopened: true, waiting_left: waitingLeft ?? 0 });
}
