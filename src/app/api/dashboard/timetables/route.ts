import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// Directory feed: every saved timetable, visible to any logged-in dashboard user.
export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("timetables")
        .select("owner_username, owner_name, domain, updated_at")
        .order("owner_name", { ascending: true });

    if (error) {
        console.error("dashboard timetables list error", error);
        return NextResponse.json({ success: false, error: "Could not load timetables." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}
