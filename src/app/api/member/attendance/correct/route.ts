import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;
const MAX_BACKDATE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 2 * 60 * 1000;

type CorrectionType = "checked_out_at" | "checked_in_at";

export async function POST(request: Request) {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!session.memberAccountId) {
        return NextResponse.json({ success: false, error: "This login has no linked member account." }, { status: 400 });
    }

    let body: { type?: CorrectionType; time?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    if (body.type !== "checked_out_at" && body.type !== "checked_in_at") {
        return NextResponse.json({ success: false, error: "Invalid correction type." }, { status: 400 });
    }

    const ts = Date.parse(body.time || "");
    if (Number.isNaN(ts)) {
        return NextResponse.json({ success: false, error: "Invalid time." }, { status: 400 });
    }
    const now = Date.now();
    if (ts > now + CLOCK_SKEW_MS) {
        return NextResponse.json({ success: false, error: "Time can't be in the future." }, { status: 400 });
    }
    if (ts < now - MAX_BACKDATE_MS) {
        return NextResponse.json({ success: false, error: "Corrections can only cover the last 24 hours." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: latest, error: latestError } = await supabase
        .from("attendance_logs")
        .select("action, occurred_at")
        .eq("member_account_id", session.memberAccountId)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestError) {
        console.error("attendance correction: latest lookup failed", latestError);
        return NextResponse.json({ success: false, error: "Could not load your attendance." }, { status: 500 });
    }

    if (body.type === "checked_out_at") {
        if (!latest || latest.action !== "IN") {
            return NextResponse.json({ success: false, error: "You don't have an open check-in to close." }, { status: 400 });
        }
        if (ts <= Date.parse(latest.occurred_at)) {
            return NextResponse.json({ success: false, error: "Check-out time must be after your check-in." }, { status: 400 });
        }
    } else {
        if (latest && latest.action === "IN") {
            return NextResponse.json({ success: false, error: "You're already checked in." }, { status: 400 });
        }
        if (latest && ts <= Date.parse(latest.occurred_at)) {
            return NextResponse.json({ success: false, error: "Check-in time must be after your last check-out." }, { status: 400 });
        }
    }

    const { error: insertError } = await supabase.from("attendance_logs").insert({
        member_account_id: session.memberAccountId,
        action: body.type === "checked_out_at" ? "OUT" : "IN",
        source: "manual_correction",
        occurred_at: new Date(ts).toISOString(),
        note: "Self-reported via dashboard",
    });

    if (insertError) {
        console.error("attendance correction: insert failed", insertError);
        return NextResponse.json({ success: false, error: "Could not save correction." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
