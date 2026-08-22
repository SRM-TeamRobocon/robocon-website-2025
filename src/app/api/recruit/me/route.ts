import { NextResponse } from "next/server";
import { getRecruitSession } from "@/lib/recruit-session";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { todayInIST } from "@/lib/recruit-dates";
import { subDomainFullLabel } from "@/lib/recruit-domains";

export const dynamic = "force-dynamic";

type ShortlistRow = { sub_domain: string; status: string };
type InterviewResultRow = { sub_domain: string; result: string };

// Boot-sequence status labels, applied in priority order (later conditions override
// earlier ones as the pipeline progresses) per 04-PAGES-AND-ROUTES.md / 05-QR-AND-SCANNING.md.
//
// Everything here is scoped to ONE sub-domain. A recruit who applied to two domains
// runs this function twice and can legitimately be DEPLOYED in one and
// DIAGNOSTIC: FAIL in the other — no signal may leak between the two.
function computeDomainStatus(params: {
    hasOrientation: boolean;
    hasExamAttendance: boolean;
    shortlistStatus: string | undefined; // 'pending' | 'shortlisted' | 'not_shortlisted' | undefined
    hasInterviewToken: boolean;
    interviewResult: string | undefined; // 'selected' | 'rejected' | 'waitlisted' | undefined
    trainingStarted: boolean;
    attendedSessions: number;
    totalSessions: number;
}): string {
    const {
        hasOrientation,
        hasExamAttendance,
        shortlistStatus,
        hasInterviewToken,
        interviewResult,
        trainingStarted,
        attendedSessions,
        totalSessions,
    } = params;

    let label = "POWER ON";

    if (hasOrientation) label = "SYSTEM CHECK: PASS";

    if (hasExamAttendance) label = "DIAGNOSTIC RUNNING";

    if (shortlistStatus === "shortlisted") label = "DIAGNOSTIC: PASS";
    if (shortlistStatus === "not_shortlisted") label = "DIAGNOSTIC: FAIL";

    // hasInterviewToken is scoped to THIS sub_domain (recruit_interview_tokens.sub_domain
    // is a denormalized copy of the panel's domain, set at check-in — see migration 004),
    // so a token checked into the recruit's OTHER domain can't flip this one to
    // CALIBRATION. Also gated on this domain actually being shortlisted, same reasoning.
    if (hasInterviewToken && !interviewResult && shortlistStatus === "shortlisted") label = "CALIBRATION";

    // Selection is per-domain: only an interview result logged against THIS sub_domain
    // counts. The account-level `recruit_accounts.is_selected` flag is deliberately not
    // consulted — it says "this person joined the team", not "this person passed every
    // domain they applied to", and using it previously showed DEPLOYED against domains
    // the recruit had been explicitly rejected from.
    const selectedForDomain = interviewResult === "selected";

    if (selectedForDomain) label = "DEPLOYED";
    if (selectedForDomain && trainingStarted) {
        label = `RUNTIME — Day ${attendedSessions} / ${totalSessions}`;
    }

    return label;
}

// GET /api/recruit/me
// Requires recruit_token (also enforced by src/proxy.ts). Returns the recruit's profile plus
// a computed boot-sequence status label per selected domain.
export async function GET() {
    const session = await getRecruitSession();
    if (!session) {
        return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    try {
        const supabase = createRecruitSupabaseAdminClient();
        const { recruit_id, cycle_id } = session;
        const today = todayInIST();

        const [
            { data: account, error: accountError },
            { data: selections },
            { data: orientationRows },
            { data: examRows },
            { data: shortlistRows },
            { data: interviewTokenRows },
            { data: interviewResultRows },
            { data: trainingSessions },
            { data: trainingAttendanceRows },
            { data: ownInterviewTokenRows },
        ] = await Promise.all([
            supabase
                .from("recruit_accounts")
                .select(
                    "id, srm_email, srm_email_verified, name, reg_no, year, gender, department, course, phone, is_hosteller, hostel_block, hostel_room, day_scholar_area, travel_method, portfolio_url, is_selected, created_at"
                )
                .eq("id", recruit_id)
                .eq("cycle_id", cycle_id)
                .maybeSingle(),
            supabase
                .from("recruit_domain_selections")
                .select("sub_domain")
                .eq("recruit_id", recruit_id)
                .eq("cycle_id", cycle_id),
            supabase
                .from("recruit_orientation_attendance")
                .select("id")
                .eq("recruit_id", recruit_id)
                .eq("cycle_id", cycle_id),
            supabase
                .from("recruit_exam_attendance")
                .select("day, sub_domain")
                .eq("recruit_id", recruit_id)
                .eq("cycle_id", cycle_id),
            supabase
                .from("recruit_shortlist_status")
                .select("sub_domain, status")
                .eq("recruit_id", recruit_id)
                .eq("cycle_id", cycle_id),
            supabase
                .from("recruit_interview_tokens")
                .select("id, sub_domain")
                .eq("recruit_id", recruit_id)
                .eq("cycle_id", cycle_id),
            supabase
                .from("recruit_interview_results")
                .select("sub_domain, result")
                .eq("recruit_id", recruit_id)
                .eq("cycle_id", cycle_id),
            // Only sessions that have actually happened count towards the attendance
            // denominator — a lead pre-creating the full training calendar must not make
            // every recruit look like they're failing attendance on day one.
            supabase
                .from("recruit_training_sessions")
                .select("id, session_date, sub_domain")
                .eq("cycle_id", cycle_id)
                .lte("session_date", today),
            supabase
                .from("recruit_training_attendance")
                .select("id, session_id")
                .eq("recruit_id", recruit_id)
                .eq("cycle_id", cycle_id),
            // Recruit's own queue position on interview day. Not tied to a sub_domain (a panel
            // is a free-text label, not a sub_domain foreign key) — same reasoning as
            // `hasInterviewToken` above, so this is recruit-level, not per-domain.
            supabase
                .from("recruit_interview_tokens")
                .select("id, panel_id, sub_domain, token_number, queue_position, status, checked_in_at, called_at")
                .eq("recruit_id", recruit_id)
                .eq("cycle_id", cycle_id),
        ]);

        if (accountError || !account) {
            return NextResponse.json({ success: false, error: "Recruit account not found" }, { status: 404 });
        }

        const hasOrientation = (orientationRows?.length ?? 0) > 0;
        // Exam attendance is per sub-domain — a recruit who sat only their coding exam
        // must not show "DIAGNOSTIC RUNNING" against their webdev application.
        const examAttendedSubDomains = new Set(
            ((examRows as { day: number; sub_domain: string }[] | null) ?? []).map((row) => row.sub_domain)
        );
        // Scoped per sub_domain (denormalized onto the token at check-in, migration 004) —
        // a recruit checked into one domain's interview must not show CALIBRATION against
        // an unrelated shortlisted domain they haven't checked into yet.
        const interviewTokenSubDomains = new Set(
            ((interviewTokenRows as { id: string; sub_domain: string | null }[] | null) ?? [])
                .map((row) => row.sub_domain)
                .filter((sd): sd is string => sd !== null)
        );
        const isSelected = Boolean(account.is_selected);

        // Training is run per domain (migration 005), so the denominator must only count
        // sessions this recruit was actually expected at. Counting every domain's sessions
        // would show a coding recruit "Day 2 / 6" purely because webdev and VFX also
        // trained that week. A NULL sub_domain means an all-hands session, which counts
        // for everyone.
        const ownSubDomains = new Set(
            ((selections as { sub_domain: string }[] | null) ?? []).map((row) => row.sub_domain)
        );
        const pastSessionIds = new Set(
            ((trainingSessions as { id: string; session_date: string; sub_domain: string | null }[] | null) ?? [])
                .filter((s) => s.sub_domain === null || ownSubDomains.has(s.sub_domain))
                .map((s) => s.id)
        );
        const totalSessions = pastSessionIds.size;
        // Clamp attendance to sessions in the denominator so a manually-marked future
        // session can't produce "Day 4 / 3".
        const attendedSessions = ((trainingAttendanceRows as { session_id: string }[] | null) ?? []).filter((row) =>
            pastSessionIds.has(row.session_id)
        ).length;
        const trainingStarted = totalSessions > 0;

        const shortlistBySubDomain = new Map<string, string>(
            ((shortlistRows as ShortlistRow[] | null) ?? []).map((row) => [row.sub_domain, row.status])
        );
        const interviewResultBySubDomain = new Map<string, string>(
            ((interviewResultRows as InterviewResultRow[] | null) ?? []).map((row) => [row.sub_domain, row.result])
        );

        const domains = (selections ?? []).map((row: { sub_domain: string }) => {
            const sub_domain = row.sub_domain;
            const status = computeDomainStatus({
                hasOrientation,
                hasExamAttendance: examAttendedSubDomains.has(sub_domain),
                shortlistStatus: shortlistBySubDomain.get(sub_domain),
                hasInterviewToken: interviewTokenSubDomains.has(sub_domain),
                interviewResult: interviewResultBySubDomain.get(sub_domain),
                trainingStarted,
                attendedSessions,
                totalSessions,
            });
            return { sub_domain, status };
        });

        // Live interview queue position. Only ever surfaces the recruit's OWN token and an
        // aggregate count of how many others are ahead of them — never other recruits'
        // identities — since this response is readable by the recruit themselves.
        let interview: {
            panel_label: string;
            token_number: number;
            status: "waiting" | "called" | "deferred";
            waiting_ahead: number;
        } | null = null;

        // A recruit shortlisted for 2 domains can legitimately hold tokens on 2 tables (or a
        // table + a deferral) at once. Prefer 'called' over 'waiting' over 'deferred' — "you're
        // being called right now" is strictly more urgent than a queue position, which is more
        // actionable than "come back another day" — rather than picking whichever row Postgres
        // happens to return first (unordered, so it could otherwise flip between page loads).
        const ownActiveTokens = (
            (ownInterviewTokenRows as
                | {
                      id: string;
                      panel_id: string;
                      sub_domain: string | null;
                      token_number: number;
                      queue_position: number;
                      status: string;
                  }[]
                | null) ?? []
        ).filter((row) => row.status === "waiting" || row.status === "called" || row.status === "deferred");
        const activeToken =
            ownActiveTokens.find((row) => row.status === "called") ??
            ownActiveTokens.find((row) => row.status === "waiting") ??
            ownActiveTokens[0];

        if (activeToken?.status === "deferred") {
            // Whatever table this token is still attached to (its original one, or a
            // reassigned placeholder if that table was since deleted) isn't meaningful here —
            // the recruit needs to know the DOMAIN they're deferred for, not a table name.
            interview = {
                panel_label: activeToken.sub_domain ? subDomainFullLabel(activeToken.sub_domain) : "Interview",
                token_number: activeToken.token_number,
                status: "deferred",
                waiting_ahead: 0,
            };
        } else if (activeToken) {
            const [{ data: panel }, waitingAheadResult] = await Promise.all([
                supabase
                    .from("recruit_interview_panels")
                    .select("domain_label")
                    .eq("id", activeToken.panel_id)
                    .maybeSingle(),
                // Ahead-of-me count follows queue_position (the manually-reorderable "who's
                // next" order), not token_number — a drag-reorder on the dashboard should be
                // reflected here immediately.
                activeToken.status === "waiting"
                    ? supabase
                          .from("recruit_interview_tokens")
                          .select("id", { count: "exact", head: true })
                          .eq("panel_id", activeToken.panel_id)
                          .eq("status", "waiting")
                          .lt("queue_position", activeToken.queue_position)
                    : Promise.resolve({ count: 0 }),
            ]);

            interview = {
                panel_label: (panel as { domain_label: string } | null)?.domain_label ?? "Interview Panel",
                token_number: activeToken.token_number,
                status: activeToken.status as "waiting" | "called",
                waiting_ahead: activeToken.status === "called" ? 0 : waitingAheadResult.count ?? 0,
            };
        }

        return NextResponse.json({
            success: true,
            recruit: {
                name: account.name,
                srm_email: account.srm_email,
                srm_email_verified: Boolean(account.srm_email_verified),
                reg_no: account.reg_no,
                year: account.year,
                gender: account.gender,
                department: account.department,
                course: account.course,
                phone: account.phone,
                is_hosteller: account.is_hosteller,
                hostel_block: account.hostel_block,
                hostel_room: account.hostel_room,
                day_scholar_area: account.day_scholar_area,
                travel_method: account.travel_method,
                portfolio_url: account.portfolio_url,
                is_selected: isSelected,
            },
            domains,
            training: {
                started: trainingStarted,
                attended: attendedSessions,
                total: totalSessions,
                percentage: totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : null,
            },
            interview,
        });
    } catch (error) {
        console.error("Error in /api/recruit/me:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
