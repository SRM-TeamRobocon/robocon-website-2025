import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/admin/recruitment/training-attendance/manual
// Body: { recruit_id, session_id }
//
// Backup for when a recruit's phone is dead / they forgot it at a training session -- a lead
// marks them present by hand instead of scanning their QR. Mirrors the "training" branch of the
// QR scan handler in 05-QR-AND-SCANNING.md: same eligibility rule (is_selected = true), same
// table (recruit_training_attendance), just method: 'manual' + marked_by: the acting lead's
// username instead of method: 'qr' + the scanning volunteer's.
//
// The DB has `unique (recruit_id, session_id)` on recruit_training_attendance, so a double-mark
// hits a Postgres 23505 unique-violation. That's not really an error from the caller's point of
// view -- the recruit IS marked present, just already was -- so it's reported as a 200 with
// status: "already_marked" rather than a 409/500, matching the QR scanner's "already_scanned"
// convention for the same situation.

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const recruitId = typeof payload.recruit_id === "string" ? payload.recruit_id.trim() : "";
  const sessionId = typeof payload.session_id === "string" ? payload.session_id.trim() : "";

  if (!recruitId || !sessionId) {
    return NextResponse.json({ success: false, error: "recruit_id and session_id are required" }, { status: 400 });
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

  const { data: sessionRow, error: sessionError } = await supabase
    .from("recruit_training_sessions")
    .select("id, session_label, sub_domain")
    .eq("id", sessionId)
    .eq("cycle_id", cycle.id)
    .maybeSingle();

  if (sessionError) {
    console.error("training-attendance/manual session lookup error", sessionError);
    return NextResponse.json({ success: false, error: "Could not verify training session" }, { status: 500 });
  }
  if (!sessionRow) {
    return NextResponse.json({ success: false, error: "Training session not found" }, { status: 404 });
  }

  const { data: recruit, error: recruitError } = await supabase
    .from("recruit_accounts")
    .select("id, name, is_selected")
    .eq("id", recruitId)
    .eq("cycle_id", cycle.id)
    .maybeSingle();

  if (recruitError) {
    console.error("training-attendance/manual recruit lookup error", recruitError);
    return NextResponse.json({ success: false, error: "Could not verify recruit" }, { status: 500 });
  }
  if (!recruit) {
    return NextResponse.json({ success: false, error: "Recruit not found" }, { status: 404 });
  }
  if (!recruit.is_selected) {
    return NextResponse.json({ success: false, error: "Not a selected recruit" }, { status: 400 });
  }

  // A domain-scoped session only concerns recruits who applied to that domain - a NULL
  // sub_domain (all-hands) concerns everyone. Mirrors the eligibility rule the overview
  // endpoint (../route.ts) uses to decide who even shows up as "pending" for this session.
  if (sessionRow.sub_domain) {
    const { data: selection, error: selectionError } = await supabase
      .from("recruit_domain_selections")
      .select("id")
      .eq("recruit_id", recruitId)
      .eq("cycle_id", cycle.id)
      .eq("sub_domain", sessionRow.sub_domain)
      .maybeSingle();

    if (selectionError) {
      console.error("training-attendance/manual selection lookup error", selectionError);
      return NextResponse.json({ success: false, error: "Could not verify domain eligibility" }, { status: 500 });
    }
    if (!selection) {
      return NextResponse.json(
        { success: false, error: `${recruit.name} did not apply for this domain` },
        { status: 400 }
      );
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("recruit_training_attendance")
    .insert({
      cycle_id: cycle.id,
      recruit_id: recruitId,
      session_id: sessionId,
      method: "manual",
      marked_by: session.user,
    })
    .select("id, scanned_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({
        success: true,
        status: "already_marked",
        name: recruit.name,
        message: "Already marked present for this session",
      });
    }
    console.error("training-attendance/manual insert error", insertError);
    return NextResponse.json({ success: false, error: "Could not mark attendance" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    status: "ok",
    name: recruit.name,
    message: `Marked present for ${sessionRow.session_label}`,
    data: inserted,
  });
}
