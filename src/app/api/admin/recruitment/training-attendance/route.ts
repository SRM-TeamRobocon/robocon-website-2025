import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { fetchAllRows } from "@/lib/supabase/query-helpers";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

// GET /api/admin/recruitment/training-attendance
//
// Training only concerns recruits who made it through selection (recruit_accounts.is_selected
// = true) -- see 05-QR-AND-SCANNING.md's "training" scan handler, which enforces the same rule.
// So every shape below is scoped to the active cycle's selected recruits, not all registrants.
//
// - With ?session_id=<uuid>: returns the full selected-recruit roster for that one session, each
//   row annotated with whether/how/when they were marked present. This single shape covers both
//   "who attended this session" (filter attended === true) and "who still needs marking" (filter
//   attended === false) for the manual-mark UI on /dashboard/recruitment/training.
// - Without session_id: returns every session for the cycle with a per-session attended count,
//   plus a per-recruit attendance percentage -- for the overview table.
//
// The percentage denominator counts only sessions that have ALREADY HAPPENED
// (session_date <= today). A lead who pre-creates all 9 sessions of a 3-week programme up
// front would otherwise make everyone read ~11% after session 1, both here and on the
// students' own dashboards. Future sessions are still returned (so the UI can list them),
// flagged with has_occurred: false and excluded from held_sessions.

interface RecruitRow {
  id: string;
  name: string;
  reg_no: string;
  // Returned on the per-session roster only, so the mark-present gender filter can narrow
  // it. Nullable on recruit_accounts - a recruit with none on file matches neither option
  // and stays visible only under "All genders". Left off the overview summary shape, like
  // phone below, since nothing there filters on it.
  gender: string | null;
  // Returned on the per-session roster only, so the mark-present search box can match a
  // number. Not rendered anywhere, and deliberately left off the overview summary shape.
  phone: string | null;
}

// Today's date in IST as YYYY-MM-DD, to compare against the `date`-typed session_date.
// The server may well be running in UTC; the team and the sessions are not.
function todayInIst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

interface AttendanceRow {
  recruit_id: string;
  session_id: string;
  method: string;
  marked_by: string;
  scanned_at: string;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
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

  // Both of these are scoped to a whole cycle rather than a bounded ID list, so at the
  // module's target scale (1000-2000 recruits, most picking 1-2 domains) they can exceed
  // PostgREST's default 1000-row response cap - paginate rather than risk a silent
  // truncation that would quietly under-report attendance for whoever got cut.
  const { data: recruitList, error: recruitsError } = await fetchAllRows<RecruitRow>((from, to) =>
    supabase
      .from("recruit_accounts")
      .select("id, name, reg_no, gender, phone")
      .eq("cycle_id", cycle.id)
      .eq("is_selected", true)
      .order("name", { ascending: true })
      .range(from, to)
  );

  if (recruitsError) {
    console.error("training-attendance recruits error", recruitsError);
    return NextResponse.json({ success: false, error: "Could not load selected recruits" }, { status: 500 });
  }

  // Training is per-domain (migration 005): a session with a sub_domain only concerns
  // recruits who applied to that domain; a NULL sub_domain (all-hands) concerns everyone.
  // Mirrors the ownership logic in src/app/api/recruit/me/route.ts so the admin overview
  // and a recruit's own "Day X / Y" never disagree.
  const { data: selections, error: selectionsError } = await fetchAllRows<{ recruit_id: string; sub_domain: string }>(
    (from, to) =>
      supabase.from("recruit_domain_selections").select("recruit_id, sub_domain").eq("cycle_id", cycle.id).range(from, to)
  );

  if (selectionsError) {
    console.error("training-attendance selections error", selectionsError);
    return NextResponse.json({ success: false, error: "Could not load domain selections" }, { status: 500 });
  }

  const domainsByRecruit = new Map<string, Set<string>>();
  (selections ?? []).forEach((row) => {
    const set = domainsByRecruit.get(row.recruit_id) ?? new Set<string>();
    set.add(row.sub_domain);
    domainsByRecruit.set(row.recruit_id, set);
  });

  function isEligible(recruitId: string, sessionSubDomain: string | null): boolean {
    if (!sessionSubDomain) return true; // all-hands session - everyone counts
    return domainsByRecruit.get(recruitId)?.has(sessionSubDomain) ?? false;
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (sessionId) {
    const { data: sessionRow, error: sessionError } = await supabase
      .from("recruit_training_sessions")
      .select("id, session_date, session_label, sub_domain")
      .eq("id", sessionId)
      .eq("cycle_id", cycle.id)
      .maybeSingle();

    if (sessionError) {
      console.error("training-attendance session lookup error", sessionError);
      return NextResponse.json({ success: false, error: "Could not load session" }, { status: 500 });
    }
    if (!sessionRow) {
      return NextResponse.json({ success: false, error: "Training session not found" }, { status: 404 });
    }

    const { data: attendance, error: attendanceError } = await fetchAllRows<{
      recruit_id: string;
      method: string;
      marked_by: string;
      scanned_at: string;
    }>((from, to) =>
      supabase.from("recruit_training_attendance").select("recruit_id, method, marked_by, scanned_at").eq("session_id", sessionId).range(from, to)
    );

    if (attendanceError) {
      console.error("training-attendance list error", attendanceError);
      return NextResponse.json({ success: false, error: "Could not load attendance" }, { status: 500 });
    }

    const attendanceMap = new Map(attendance.map((row) => [row.recruit_id, row]));
    const markedByNames = await resolveDisplayNames(supabase, attendance.map((row) => row.marked_by));

    const eligibleRecruits = recruitList.filter((recruit) => isEligible(recruit.id, sessionRow.sub_domain));

    const recruitsWithStatus = eligibleRecruits.map((recruit) => {
      const marked = attendanceMap.get(recruit.id);
      return {
        recruit_id: recruit.id,
        name: recruit.name,
        reg_no: recruit.reg_no,
        gender: recruit.gender,
        phone: recruit.phone,
        attended: Boolean(marked),
        method: marked?.method ?? null,
        marked_by: marked ? markedByNames.get(marked.marked_by) ?? marked.marked_by : null,
        scanned_at: marked?.scanned_at ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      session: sessionRow,
      recruits: recruitsWithStatus,
      attendedCount: recruitsWithStatus.filter((r) => r.attended).length,
      totalSelected: eligibleRecruits.length,
    });
  }

  // No session_id: build the all-sessions summary + per-recruit attendance percentage.
  const { data: sessions, error: sessionsError } = await supabase
    .from("recruit_training_sessions")
    .select("id, session_date, session_label, sub_domain")
    .eq("cycle_id", cycle.id)
    .order("session_date", { ascending: true });

  if (sessionsError) {
    console.error("training-attendance sessions error", sessionsError);
    return NextResponse.json({ success: false, error: "Could not load training sessions" }, { status: 500 });
  }

  const sessionList = (sessions || []) as { id: string; session_date: string; session_label: string; sub_domain: string | null }[];
  const sessionIds = sessionList.map((s) => s.id);

  let allAttendance: AttendanceRow[] = [];
  if (sessionIds.length > 0) {
    // Bounded by (recruits × sessions), not just recruits - a full multi-week programme
    // easily clears 1000 rows well before hitting the recruit-count target scale.
    const { data: attendanceRows, error: attendanceError } = await fetchAllRows<AttendanceRow>((from, to) =>
      supabase
        .from("recruit_training_attendance")
        .select("recruit_id, session_id, method, marked_by, scanned_at")
        .in("session_id", sessionIds)
        .range(from, to)
    );

    if (attendanceError) {
      console.error("training-attendance bulk error", attendanceError);
      return NextResponse.json({ success: false, error: "Could not load attendance" }, { status: 500 });
    }
    allAttendance = attendanceRows;
  }

  // A day with no session row for a domain simply isn't in sessionList at all - it never
  // enters anyone's denominator, i.e. it's a holiday, not an absence. Only actual session
  // rows (created by "Start Attendance" or a volunteer's first scan of the day) count.
  const today = todayInIst();
  const heldSessionIds = new Set(
    sessionList.filter((s) => String(s.session_date).slice(0, 10) <= today).map((s) => s.id)
  );
  const heldSessionCount = heldSessionIds.size;

  const sessionsSummary = sessionList.map((s) => {
    const eligibleCount = recruitList.filter((r) => isEligible(r.id, s.sub_domain)).length;
    return {
      id: s.id,
      session_date: s.session_date,
      session_label: s.session_label,
      sub_domain: s.sub_domain,
      attended_count: allAttendance.filter((a) => a.session_id === s.id).length,
      total_selected: eligibleCount,
      has_occurred: heldSessionIds.has(s.id),
    };
  });

  const recruitsSummary = recruitList.map((recruit) => {
    // Denominator: held sessions this recruit is actually eligible for (own domain(s) +
    // any all-hands session) - not every session ever held. Numerator is intersected with
    // the same set so a stray attendance row from outside the recruit's domain(s) can't
    // push their count past their own denominator.
    const ownHeldSessionIds = sessionList
      .filter((s) => heldSessionIds.has(s.id) && isEligible(recruit.id, s.sub_domain))
      .map((s) => s.id);
    const ownHeldSessionSet = new Set(ownHeldSessionIds);

    const sessionsAttended = allAttendance.filter(
      (a) => a.recruit_id === recruit.id && ownHeldSessionSet.has(a.session_id)
    ).length;
    const totalSessions = ownHeldSessionSet.size;
    return {
      recruit_id: recruit.id,
      name: recruit.name,
      reg_no: recruit.reg_no,
      sessions_attended: sessionsAttended,
      total_sessions: totalSessions,
      percentage: totalSessions > 0 ? Math.round((sessionsAttended / totalSessions) * 100) : 0,
    };
  });

  return NextResponse.json({
    success: true,
    sessions: sessionsSummary,
    recruits: recruitsSummary,
    held_sessions: heldSessionCount,
    total_sessions_created: sessionList.length,
  });
}
