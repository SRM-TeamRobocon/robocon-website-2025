import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;

// SRM is IST-only; "today" is computed in that zone so the leave window lines up
// with the campus day, not the server's UTC day.
function todayIST(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const today = todayIST();
    const supabase = createSupabaseAdminClient();
    // owner_username on timetables is the member's login email, which is also
    // member_accounts.email — join it here so callers (e.g. the timetable directory,
    // keyed by owner_username) can match a leave request to a row without a second round trip.
    const { data, error } = await supabase
        .from("leave_requests")
        .select("id, member_account_id, owner_name, domain, start_date, end_date, start_time, end_time, reason, member_accounts(email)")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);

    if (error) {
        console.error("leave-requests/today error", error);
        return NextResponse.json({ success: false, error: "Could not load today's leave." }, { status: 500 });
    }

    return NextResponse.json({ success: true, today, data });
}
