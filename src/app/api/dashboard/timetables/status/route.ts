import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { normalizeSchedule } from "@/lib/timetable";
import { ADMIN_USERNAME_MAP } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

// Feeds the "who's free" search: the full dashboard roster (so members with no saved
// timetable can be shown as "no data" instead of silently vanishing) plus every saved
// schedule, keyed by owner_username exactly as /api/member/timetable stores it — the
// email for member_accounts logins, the env username for legacy lead/admin logins.
export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    const [{ data: accounts, error: accountsError }, { data: timetables, error: timetablesError }] = await Promise.all([
        supabase.from("member_accounts").select("email, name, domain, role").eq("is_approved", true),
        supabase.from("timetables").select("owner_username, schedule"),
    ]);

    if (accountsError || timetablesError) {
        console.error("timetable status error", accountsError || timetablesError);
        return NextResponse.json({ success: false, error: "Could not load timetable status." }, { status: 500 });
    }

    const members = (accounts || []).map((a) => ({
        username: a.email,
        name: a.name,
        domain: a.domain as string | null,
        role: a.role,
    }));

    for (const [username, name] of Object.entries(ADMIN_USERNAME_MAP)) {
        if (!members.some((m) => m.username === username)) {
            members.push({ username, name, domain: null, role: "admin" });
        }
    }

    members.sort((a, b) => a.name.localeCompare(b.name));

    const schedules: Record<string, ReturnType<typeof normalizeSchedule>> = {};
    for (const row of timetables || []) {
        schedules[row.owner_username] = normalizeSchedule(row.schedule);
    }

    return NextResponse.json({ success: true, members, schedules });
}
