import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { normalizeCampus, normalizeSchedule } from "@/lib/timetable";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { username } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("timetables")
        .select("owner_username, owner_name, domain, schedule, campus, updated_at")
        .eq("owner_username", username)
        .maybeSingle();

    if (error) {
        console.error("dashboard timetable detail error", error);
        return NextResponse.json({ success: false, error: "Could not load timetable." }, { status: 500 });
    }
    if (!data) {
        return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        data: { ...data, schedule: normalizeSchedule(data.schedule), campus: normalizeCampus(data.campus) },
    });
}
