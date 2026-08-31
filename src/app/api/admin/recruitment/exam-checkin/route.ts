import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { RECRUIT_SUBDOMAINS } from "@/lib/recruit-domains";
import { fetchAllRows } from "@/lib/supabase/query-helpers";

export const dynamic = "force-dynamic";

type Account = { name: string; reg_no: string } | { name: string; reg_no: string }[] | null;
const accountOf = (acc: Account) => (Array.isArray(acc) ? acc[0] : acc);

type AttendanceRow = {
    id: string;
    recruit_id: string;
    sub_domain: string;
    day: number;
    scanned_at: string;
    recruit_accounts: Account;
};

// GET /api/admin/recruitment/exam-checkin?day=1|2|all
//
// Backs the exam check-in board at /dashboard/recruitment/exam-checkin — the exam-day
// equivalent of the interview board: one column per domain showing who has been scanned in,
// so a recruit standing at the hall door can look at the screen and confirm their own
// check-in registered instead of asking a volunteer to re-scan them.
//
// All six domains come back in ONE call rather than one call per domain: the board shows
// them side by side, and its search box has to work across domains (a recruit sitting two
// exams needs to find themselves in either column).
//
// Not public, unlike the interview kiosk at /api/recruit/tables — this returns full names
// AND reg numbers, which is the whole point (a first name alone can't disambiguate 1000+
// recruits), so it stays behind admin_token and is meant to be shown on a volunteer's screen.
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const dayParam = new URL(request.url).searchParams.get("day") ?? "1";
    if (dayParam !== "1" && dayParam !== "2" && dayParam !== "all") {
        return NextResponse.json({ success: false, error: "day must be 1, 2 or all" }, { status: 400 });
    }

    const supabase = createRecruitSupabaseAdminClient();

    const { data: cycle } = await supabase
        .from("recruitment_cycles")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

    if (!cycle) {
        return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
    }

    const [{ data: attendance, error: attendanceError }, registeredCounts] = await Promise.all([
        // Paged: at the module's target scale a single exam day across six domains can clear
        // PostgREST's silent 1000-row cap, and a board that quietly stops listing people past
        // row 1000 is worse than no board at all. Ordered by (scanned_at desc, id desc) rather
        // than scanned_at alone so the paging is deterministic — two scans in the same
        // millisecond would otherwise be free to swap pages and get duplicated or skipped.
        fetchAllRows<AttendanceRow>((from, to) => {
            let q = supabase
                .from("recruit_exam_attendance")
                .select("id, recruit_id, sub_domain, day, scanned_at, recruit_accounts(name, reg_no)")
                .eq("cycle_id", cycle.id);
            if (dayParam !== "all") q = q.eq("day", Number(dayParam));
            return q
                .order("scanned_at", { ascending: false })
                .order("id", { ascending: false })
                .range(from, to);
        }),
        // The "42 of 118" denominator: how many people picked this domain at registration.
        // Six bounded head-counts in parallel, so no rows cross the wire for this half.
        Promise.all(
            RECRUIT_SUBDOMAINS.map(async (d) => {
                const { count } = await supabase
                    .from("recruit_domain_selections")
                    .select("id", { count: "exact", head: true })
                    .eq("cycle_id", cycle.id)
                    .eq("sub_domain", d.key);
                return [d.key, count ?? 0] as const;
            })
        ),
    ]);

    if (attendanceError) {
        console.error("recruitment exam-checkin GET error", attendanceError);
        return NextResponse.json({ success: false, error: "Could not load check-ins" }, { status: 500 });
    }

    const registered = new Map(registeredCounts);

    const byDomain = new Map<string, Array<{ recruit_id: string; name: string; reg_no: string; day: number; at: string }>>();
    for (const row of attendance) {
        const acc = accountOf(row.recruit_accounts);
        const list = byDomain.get(row.sub_domain) ?? [];
        list.push({
            recruit_id: row.recruit_id,
            name: acc?.name ?? "Unknown",
            reg_no: acc?.reg_no ?? "",
            day: row.day,
            at: row.scanned_at,
        });
        byDomain.set(row.sub_domain, list);
    }

    // Always all six, in RECRUIT_SUBDOMAINS order — a domain nobody has scanned into yet
    // still gets a column, so the board's shape doesn't shift as the morning goes on.
    const domains = RECRUIT_SUBDOMAINS.map((d) => ({
        sub_domain: d.key,
        label: d.label,
        subsystem: d.subsystem,
        registered: registered.get(d.key) ?? 0,
        checked_in: byDomain.get(d.key) ?? [],
    }));

    return NextResponse.json({ success: true, day: dayParam, cycle_id: cycle.id, domains });
}
