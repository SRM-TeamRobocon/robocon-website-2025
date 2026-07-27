import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { emptySchedule, normalizeSchedule } from "@/lib/timetable";
import type { Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("timetables")
        .select("schedule, updated_at")
        .eq("owner_username", session.user)
        .maybeSingle();

    if (error) {
        console.error("member timetable fetch error", error);
        return NextResponse.json({ success: false, error: "Could not load timetable." }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ success: true, hasSaved: false, schedule: emptySchedule(), updatedAt: null });
    }

    return NextResponse.json({
        success: true,
        hasSaved: true,
        schedule: normalizeSchedule(data.schedule),
        updatedAt: data.updated_at,
    });
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, [...DASHBOARD_ROLES])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const schedule = normalizeSchedule(body.schedule);

        const supabase = createSupabaseAdminClient();
        const { error } = await supabase.from("timetables").upsert(
            {
                owner_username: session.user,
                owner_name: session.name || session.user,
                domain: session.domain || null,
                schedule: schedule as unknown as Json,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "owner_username" }
        );

        if (error) {
            console.error("member timetable save error", error);
            return NextResponse.json({ success: false, error: "Could not save timetable." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("member timetable PUT error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
