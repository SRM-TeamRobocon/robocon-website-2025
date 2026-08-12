import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { RECRUIT_SUBDOMAIN_KEYS } from "@/lib/recruit-domains";
import { fetchAllRows } from "@/lib/supabase/query-helpers";

export const dynamic = "force-dynamic";

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

// GET /api/admin/recruitment/analytics — funnel stats for the active cycle, overall and
// per sub-domain, plus training attendance % per session. Read-only aggregation across the
// recruit_ tables — no dependency on any other route.
export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
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

  // Every one of these is scoped to the whole cycle rather than a bounded ID list, so at
  // the module's target scale (1000-2000 recruits, most picking 1-2 domains) several of
  // them can exceed PostgREST's default 1000-row response cap. That cap is silent — no
  // error, just the first 1000 rows — so an un-paginated fetch here would make the funnel
  // numbers quietly wrong past that point rather than fail loudly. fetchAllRows pages
  // through with .range() until it sees a short page.
  const [
    accountsRes,
    selectionsRes,
    orientationRes,
    examRes,
    shortlistRes,
    interviewRes,
    sessionsRes,
    trainingAttendanceRes,
  ] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_accounts").select("id, is_selected").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_domain_selections").select("recruit_id, sub_domain").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_orientation_attendance").select("recruit_id").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_exam_attendance").select("recruit_id, sub_domain, day").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_shortlist_status").select("recruit_id, sub_domain, status").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_interview_results").select("recruit_id, sub_domain, result").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from("recruit_training_sessions")
        .select("id, session_date, session_label")
        .eq("cycle_id", cycle.id)
        .order("session_date", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_training_attendance").select("recruit_id, session_id").eq("cycle_id", cycle.id).range(from, to)
    ),
  ]);

  const firstError =
    accountsRes.error ||
    selectionsRes.error ||
    orientationRes.error ||
    examRes.error ||
    shortlistRes.error ||
    interviewRes.error ||
    sessionsRes.error ||
    trainingAttendanceRes.error;

  if (firstError) {
    console.error("recruitment analytics error", firstError);
    return NextResponse.json({ success: false, error: "Could not load analytics." }, { status: 500 });
  }

  const accounts = accountsRes.data;
  const domainSelections = selectionsRes.data;
  const shortlist = shortlistRes.data;
  const interviews = interviewRes.data;

  const examAttendance = examRes.data;

  const orientationIds = new Set(orientationRes.data.map((row: any) => row.recruit_id));
  const examIds = new Set(examAttendance.map((row: any) => row.recruit_id));
  const interviewedIds = new Set(interviews.map((row: any) => row.recruit_id));
  const shortlistedIds = new Set(
    shortlist.filter((row: any) => row.status === "shortlisted").map((row: any) => row.recruit_id)
  );
  // `selected` is derived from interview results in BOTH the overall and the per-domain
  // block. It used to read recruit_accounts.is_selected here and interview rows there, so
  // the two numbers drifted apart permanently after any post-hoc correction to either side.
  const selectedIds = new Set(
    interviews.filter((row: any) => row.result === "selected").map((row: any) => row.recruit_id)
  );

  // Exam attendance is keyed per sub-domain since migration 001, so it can be attributed to
  // the exam the recruit actually sat. Previously a flat "anyone with an exam row" set was
  // intersected with each domain's applicants, which credited a coding+vfx_gfx student who
  // sat only the coding exam to VFX/GFX too — a stage that domain doesn't even have.
  const examIdsByDomain = new Map<string, Set<string>>();
  for (const row of examAttendance as any[]) {
    if (!row.sub_domain) continue;
    let bucket = examIdsByDomain.get(row.sub_domain);
    if (!bucket) {
      bucket = new Set<string>();
      examIdsByDomain.set(row.sub_domain, bucket);
    }
    bucket.add(row.recruit_id);
  }

  const overall = {
    registered: accounts.length,
    orientation: orientationIds.size,
    exam_attended: examIds.size,
    shortlisted: shortlistedIds.size,
    interviewed: interviewedIds.size,
    selected: selectedIds.size,
  };

  const byDomain = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const domainRecruitIds = new Set(
      domainSelections.filter((row: any) => row.sub_domain === domain).map((row: any) => row.recruit_id)
    );
    const domainExamIds = examIdsByDomain.get(domain);

    let orientation = 0;
    let examAttended = 0;
    domainRecruitIds.forEach((id) => {
      if (orientationIds.has(id)) orientation += 1;
      if (domainExamIds?.has(id)) examAttended += 1;
    });

    const shortlistedCount = shortlist.filter(
      (row: any) => row.sub_domain === domain && row.status === "shortlisted"
    ).length;
    const interviewedCount = interviews.filter((row: any) => row.sub_domain === domain).length;
    const selectedCount = interviews.filter(
      (row: any) => row.sub_domain === domain && row.result === "selected"
    ).length;

    return {
      sub_domain: domain,
      registered: domainRecruitIds.size,
      orientation,
      exam_attended: examAttended,
      shortlisted: shortlistedCount,
      interviewed: interviewedCount,
      selected: selectedCount,
    };
  });

  const sessions = sessionsRes.data;
  const trainingAttendance = trainingAttendanceRes.data;

  // Training rosters key off recruit_accounts.is_selected — that is the flag the training
  // QR scanner and /api/admin/recruitment/training-attendance both gate on, so the
  // denominator here has to match it rather than the interview-result set used above.
  const trainingRosterIds = new Set(accounts.filter((a: any) => a.is_selected).map((a: any) => a.id));
  // Fall back to "anyone who ever showed up in any session" if no one has been flagged
  // selected yet (e.g. analytics viewed before the interview stage runs).
  const totalTrainees =
    trainingRosterIds.size > 0
      ? trainingRosterIds.size
      : new Set(trainingAttendance.map((row: any) => row.recruit_id)).size;

  // Sessions that have not happened yet are reported but excluded from every aggregate —
  // a lead who pre-creates a whole 3-week programme should not see the average collapse.
  const today = todayInIst();
  const sessionStats = sessions.map((s: any) => {
    const hasOccurred = String(s.session_date).slice(0, 10) <= today;
    const presentCount = trainingAttendance.filter((row: any) => row.session_id === s.id).length;
    const attendancePct = totalTrainees > 0 ? Math.round((presentCount / totalTrainees) * 1000) / 10 : 0;
    return {
      id: s.id,
      session_date: s.session_date,
      session_label: s.session_label,
      present_count: presentCount,
      attendance_pct: hasOccurred ? attendancePct : null,
      has_occurred: hasOccurred,
    };
  });

  const heldSessions = sessionStats.filter((s) => s.has_occurred);
  const averageAttendancePct =
    heldSessions.length > 0
      ? Math.round(
          (heldSessions.reduce((sum, s) => sum + (s.attendance_pct ?? 0), 0) / heldSessions.length) * 10
        ) / 10
      : 0;

  return NextResponse.json({
    success: true,
    cycle,
    overall,
    by_domain: byDomain,
    training: {
      total_trainees: totalTrainees,
      sessions: sessionStats,
      held_sessions: heldSessions.length,
      total_sessions_created: sessionStats.length,
      average_attendance_pct: averageAttendancePct,
    },
  });
}
