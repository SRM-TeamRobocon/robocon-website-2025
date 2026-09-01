import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { RECRUIT_SUBDOMAINS } from "@/lib/recruit-domains";
import { fetchAllRows } from "@/lib/supabase/query-helpers";

export const dynamic = "force-dynamic";

// `phone` rides along ONLY so the board's search box can match it, and `gender` ONLY so the
// board's gender pills can filter on it — see the CheckIn type below. Neither is rendered.
type AccountFields = { name: string; reg_no: string; year: string; gender: string | null; phone: string | null };
type Account = AccountFields | AccountFields[] | null;
const accountOf = (acc: Account) => (Array.isArray(acc) ? acc[0] : acc);

type AttendanceRow = {
    id: string;
    recruit_id: string;
    sub_domain: string;
    day: number;
    scanned_at: string;
    recruit_accounts: Account;
};

type SelectionRow = {
    id: string;
    sub_domain: string;
    recruit_accounts: { year: string } | { year: string }[] | null;
};

// `year` is free text on recruit_accounts holding "1" or "2" (registration only ever offers
// those two — see the Year select on /dashboard/recruitment/recruits). Anything else is
// bucketed into "other" rather than dropped: a recruit with a bad year value still physically
// sat the exam, and a board that silently omits them is worse than one showing an odd label.
type YearBucket = "year1" | "year2" | "other";

function yearBucket(year: string | undefined | null): YearBucket {
    if (year === "1") return "year1";
    if (year === "2") return "year2";
    return "other";
}

const EMPTY_COUNTS = (): Record<YearBucket, number> => ({ year1: 0, year2: 0, other: 0 });

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
// Everything is split Year 1 / Year 2, both the checked-in lists and the registered
// denominators, because the two years sit different papers and turnout is tracked per year.
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

    const [{ data: attendance, error: attendanceError }, { data: selections, error: selectionsError }] = await Promise.all([
        // Paged: at the module's target scale a single exam day across six domains can clear
        // PostgREST's silent 1000-row cap, and a board that quietly stops listing people past
        // row 1000 is worse than no board at all. Ordered by (scanned_at desc, id desc) rather
        // than scanned_at alone so the paging is deterministic — two scans in the same
        // millisecond would otherwise be free to swap pages and get duplicated or skipped.
        fetchAllRows<AttendanceRow>((from, to) => {
            let q = supabase
                .from("recruit_exam_attendance")
                .select("id, recruit_id, sub_domain, day, scanned_at, recruit_accounts(name, reg_no, year, gender, phone)")
                .eq("cycle_id", cycle.id);
            if (dayParam !== "all") q = q.eq("day", Number(dayParam));
            return q
                .order("scanned_at", { ascending: false })
                .order("id", { ascending: false })
                .range(from, to);
        }),
        // The "15 of 40" denominators. Fetched and counted in JS rather than as a dozen
        // head-count queries, because the per-year split needs a join onto recruit_accounts
        // and an unexpected `year` value has to land somewhere visible instead of vanishing
        // between six domain counts that no longer add up.
        fetchAllRows<SelectionRow>((from, to) =>
            supabase
                .from("recruit_domain_selections")
                .select("id, sub_domain, recruit_accounts(year)")
                .eq("cycle_id", cycle.id)
                .order("id", { ascending: true })
                .range(from, to)
        ),
    ]);

    if (attendanceError || selectionsError) {
        console.error("recruitment exam-checkin GET error", attendanceError || selectionsError);
        return NextResponse.json({ success: false, error: "Could not load check-ins" }, { status: 500 });
    }

    const registeredByDomain = new Map<string, Record<YearBucket, number>>();
    for (const row of selections) {
        const acc = Array.isArray(row.recruit_accounts) ? row.recruit_accounts[0] : row.recruit_accounts;
        const counts = registeredByDomain.get(row.sub_domain) ?? EMPTY_COUNTS();
        counts[yearBucket(acc?.year)] += 1;
        registeredByDomain.set(row.sub_domain, counts);
    }

    // `phone` is SEARCH-ONLY and `gender` is FILTER-ONLY. This board is projected on a screen
    // at the exam hall in front of every recruit in the queue, so neither must EVER be
    // rendered in a row — phone is here purely so the board's "find yourself" box can match a
    // number, and gender purely so a volunteer can narrow the columns to one hall section.
    // Don't add either to the JSX on /dashboard/recruitment/exam-checkin.
    // gender stays nullable end to end: a recruit with none on file is still listed, and is
    // simply not matched by either specific pill.
    type CheckIn = { recruit_id: string; name: string; reg_no: string; year: string; gender: string | null; phone: string | null; day: number; at: string };
    const checkedInByDomain = new Map<string, Record<YearBucket, CheckIn[]>>();
    for (const row of attendance) {
        const acc = accountOf(row.recruit_accounts);
        const buckets = checkedInByDomain.get(row.sub_domain) ?? { year1: [], year2: [], other: [] };
        buckets[yearBucket(acc?.year)].push({
            recruit_id: row.recruit_id,
            name: acc?.name ?? "Unknown",
            reg_no: acc?.reg_no ?? "",
            year: acc?.year ?? "",
            gender: acc?.gender ?? null,
            phone: acc?.phone ?? null,
            day: row.day,
            at: row.scanned_at,
        });
        checkedInByDomain.set(row.sub_domain, buckets);
    }

    // Always all six, in RECRUIT_SUBDOMAINS order — a domain nobody has scanned into yet
    // still gets a column, so the board's shape doesn't shift as the morning goes on.
    const domains = RECRUIT_SUBDOMAINS.map((d) => {
        const registered = registeredByDomain.get(d.key) ?? EMPTY_COUNTS();
        const checked_in = checkedInByDomain.get(d.key) ?? { year1: [], year2: [], other: [] };
        return {
            sub_domain: d.key,
            label: d.label,
            subsystem: d.subsystem,
            registered: {
                ...registered,
                total: registered.year1 + registered.year2 + registered.other,
            },
            checked_in,
            total_checked_in: checked_in.year1.length + checked_in.year2.length + checked_in.other.length,
        };
    });

    return NextResponse.json({ success: true, day: dayParam, cycle_id: cycle.id, domains });
}
