import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { todayInIST } from "@/lib/recruit-dates";

export const dynamic = "force-dynamic";

const ROSTER_ROW_CAP = 200;

type Mode = "orientation" | "exam_day_1" | "exam_day_2" | "exam_walkin" | "interview" | "training";
const VALID_MODES: Mode[] = ["orientation", "exam_day_1", "exam_day_2", "exam_walkin", "interview", "training"];

type Account = { name: string; reg_no: string } | { name: string; reg_no: string }[] | null;
const nameOf = (acc: Account) => (Array.isArray(acc) ? acc[0] : acc);

// GET /api/admin/recruitment/scan/roster?mode=X&sub_domain=Y
// Live "who's been marked present" list for the scanner page, scoped to whichever mode
// (and sub_domain, where relevant) is currently selected - lets a volunteer visually
// confirm a scan actually registered, without relying only on the scanner's ephemeral
// per-device "Recent scans" list, which is lost on reload and never shared across devices.
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") as Mode | null;
    const sub_domain = searchParams.get("sub_domain") || undefined;

    if (!mode || !VALID_MODES.includes(mode)) {
        return NextResponse.json({ success: false, error: "Invalid mode" }, { status: 400 });
    }
    if (mode !== "orientation" && !isRecruitSubDomain(sub_domain)) {
        return NextResponse.json({ success: false, error: "sub_domain is required for this mode" }, { status: 400 });
    }

    const supabase = createRecruitSupabaseAdminClient();
    const { data: cycle } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
    if (!cycle) {
        return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
    }

    let rows: any[] = [];
    let error: unknown = null;

    if (mode === "orientation") {
        const res = await supabase
            .from("recruit_orientation_attendance")
            .select("recruit_id, scanned_at, recruit_accounts(name, reg_no)")
            .eq("cycle_id", cycle.id)
            .order("scanned_at", { ascending: false })
            .limit(ROSTER_ROW_CAP);
        rows = res.data || [];
        error = res.error;
        rows = rows.map((r) => ({ recruit_id: r.recruit_id, at: r.scanned_at, account: r.recruit_accounts }));
    } else if (mode === "exam_day_1" || mode === "exam_day_2" || mode === "exam_walkin") {
        // Walk-in rows carry day = null (see recruit-migration-021), so they're matched by
        // is_walkin instead of a day number - the two are mutually exclusive by CHECK
        // constraint, never both true for the same row.
        let query = supabase
            .from("recruit_exam_attendance")
            .select("recruit_id, scanned_at, recruit_accounts(name, reg_no)")
            .eq("cycle_id", cycle.id)
            .eq("sub_domain", sub_domain as string);
        query = mode === "exam_walkin" ? query.eq("is_walkin", true) : query.eq("day", mode === "exam_day_1" ? 1 : 2);
        const res = await query.order("scanned_at", { ascending: false }).limit(ROSTER_ROW_CAP);
        rows = res.data || [];
        error = res.error;
        rows = rows.map((r) => ({ recruit_id: r.recruit_id, at: r.scanned_at, account: r.recruit_accounts }));
    } else if (mode === "interview") {
        const res = await supabase
            .from("recruit_interview_tokens")
            .select("recruit_id, checked_in_at, status, token_number, recruit_accounts(name, reg_no)")
            .eq("cycle_id", cycle.id)
            .eq("sub_domain", sub_domain as string)
            .order("checked_in_at", { ascending: false })
            .limit(ROSTER_ROW_CAP);
        rows = res.data || [];
        error = res.error;
        rows = rows.map((r) => ({
            recruit_id: r.recruit_id,
            at: r.checked_in_at,
            account: r.recruit_accounts,
            status: r.status,
            token_number: r.token_number,
        }));
    } else {
        // Training has no lead-created session step - today's (cycle, date, domain) session
        // is created on demand by the first scan (see the scan route), so if nobody's
        // tapped in yet today there's simply no session row and thus nothing to show.
        const sessionDate = todayInIST();
        const { data: todaySession } = await supabase
            .from("recruit_training_sessions")
            .select("id")
            .eq("cycle_id", cycle.id)
            .eq("session_date", sessionDate)
            .eq("sub_domain", sub_domain as string)
            .maybeSingle();

        if (!todaySession) {
            return NextResponse.json({ success: true, data: [] });
        }

        const res = await supabase
            .from("recruit_training_attendance")
            .select("recruit_id, scanned_at, method, recruit_accounts(name, reg_no)")
            .eq("session_id", todaySession.id)
            .order("scanned_at", { ascending: false })
            .limit(ROSTER_ROW_CAP);
        rows = res.data || [];
        error = res.error;
        rows = rows.map((r) => ({ recruit_id: r.recruit_id, at: r.scanned_at, account: r.recruit_accounts, method: r.method }));
    }

    if (error) {
        console.error("scan roster error", error);
        return NextResponse.json({ success: false, error: "Could not load roster" }, { status: 500 });
    }

    const data = rows.map((r) => {
        const acc = nameOf(r.account);
        return {
            recruit_id: r.recruit_id as string,
            name: acc?.name ?? "Unknown",
            reg_no: acc?.reg_no ?? "",
            at: r.at as string,
            ...(r.status ? { status: r.status, token_number: r.token_number } : {}),
            ...(r.method ? { method: r.method } : {}),
        };
    });

    return NextResponse.json({ success: true, data });
}
