import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/admin/recruitment/training-sessions/:id — lead/admin.
//
// Before this route a mistyped or double-clicked session was permanent, and because it
// counted towards the attendance denominator it dragged every recruit's percentage down
// for the rest of the programme.
//
// Migration 002 adds ON DELETE CASCADE to recruit_training_attendance.session_id, but this
// route still deletes the child rows explicitly first: it makes the deleted count reportable
// and keeps the route working on a database where the migration has not been applied yet.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing session id" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  // Scope the lookup to the active cycle so a stale tab can't delete a past season's session.
  const { data: sessionRow, error: lookupError } = await supabase
    .from("recruit_training_sessions")
    .select("id, session_date, session_label")
    .eq("id", id)
    .eq("cycle_id", cycle.id)
    .maybeSingle();

  if (lookupError) {
    console.error("training-sessions DELETE lookup error", lookupError);
    return NextResponse.json({ success: false, error: "Could not delete training session" }, { status: 500 });
  }
  if (!sessionRow) {
    return NextResponse.json({ success: false, error: "Training session not found" }, { status: 404 });
  }

  const { count: attendanceCount, error: countError } = await supabase
    .from("recruit_training_attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", id);

  if (countError) {
    console.error("training-sessions DELETE count error", countError);
    return NextResponse.json({ success: false, error: "Could not delete training session" }, { status: 500 });
  }

  const { error: attendanceError } = await supabase
    .from("recruit_training_attendance")
    .delete()
    .eq("session_id", id);

  if (attendanceError) {
    console.error("training-sessions DELETE attendance error", attendanceError);
    return NextResponse.json({ success: false, error: "Could not delete training session" }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("recruit_training_sessions")
    .delete()
    .eq("id", id)
    .eq("cycle_id", cycle.id);

  if (deleteError) {
    console.error("training-sessions DELETE error", deleteError);
    return NextResponse.json({ success: false, error: "Could not delete training session" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deleted_attendance: attendanceCount ?? 0,
    session: sessionRow,
  });
}
