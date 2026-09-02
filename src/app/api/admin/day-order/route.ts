import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const VALID_DAY_ORDERS = new Set(["DO1", "DO2", "DO3", "DO4", "DO5"]);

function todayIST(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// Manual override for day_order_log - the Academia sync bot will fail sometimes
// (holiday quirks, portal changes, outages); without this the whole day-order
// feature goes dark until someone fixes the scraper.
export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["lead", "admin"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const date = String(body.date || todayIST());
        const dayOrder = String(body.dayOrder || "");

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json({ success: false, error: "Invalid date." }, { status: 400 });
        }
        if (!VALID_DAY_ORDERS.has(dayOrder)) {
            return NextResponse.json({ success: false, error: "Invalid day order." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { error } = await supabase
            .from("day_order_log")
            .upsert({ date, day_order: dayOrder, source: "manual", synced_at: new Date().toISOString() }, { onConflict: "date" });

        if (error) {
            console.error("admin day-order override error", error);
            return NextResponse.json({ success: false, error: "Could not save override." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("admin day-order PATCH error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
