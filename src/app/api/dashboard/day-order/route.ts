import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;

function todayIST(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const today = todayIST();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("day_order_log")
        .select("date, day_order, source, synced_at")
        .gte("date", since)
        .order("date", { ascending: false });

    if (error) {
        console.error("day-order fetch error", error);
        return NextResponse.json({ success: false, error: "Could not load day order." }, { status: 500 });
    }

    const todayEntry = (data || []).find((row) => row.date === today) || null;

    return NextResponse.json({ success: true, today, todayEntry, history: data });
}
