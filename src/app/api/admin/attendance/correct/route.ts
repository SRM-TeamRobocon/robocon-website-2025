import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { broadcastAttendanceEvent } from "@/lib/attendance";

export const dynamic = "force-dynamic";

// Lead/admin version of /api/member/attendance/correct — same event-log model (attendance_logs
// is append-only; a "correction" is a new row, never an edit of an existing one), but scoped to
// an arbitrary member instead of the caller's own account, and with no backdate cap: a self-
// correction caps at 24h to limit a member gaming their own hours, but a lead fixing someone
// else's forgotten tap (possibly from days ago) isn't the same trust boundary.
const CLOCK_SKEW_MS = 2 * 60 * 1000;

type CorrectionType = "checked_out_at" | "checked_in_at";

export async function POST(request: Request) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let body: { memberAccountId?: string; type?: CorrectionType; time?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    if (!body.memberAccountId) {
        return NextResponse.json({ success: false, error: "Missing memberAccountId." }, { status: 400 });
    }
    if (body.type !== "checked_out_at" && body.type !== "checked_in_at") {
        return NextResponse.json({ success: false, error: "Invalid correction type." }, { status: 400 });
    }

    // No time supplied = "force it now" (the one-click logout-anyone action).
    const ts = body.time ? Date.parse(body.time) : Date.now();
    if (Number.isNaN(ts)) {
        return NextResponse.json({ success: false, error: "Invalid time." }, { status: 400 });
    }
    if (ts > Date.now() + CLOCK_SKEW_MS) {
        return NextResponse.json({ success: false, error: "Time can't be in the future." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const [{ data: latest, error: latestError }, { data: roster }, { data: account }] = await Promise.all([
        supabase
            .from("attendance_logs")
            .select("action, occurred_at")
            .eq("member_account_id", body.memberAccountId)
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase.from("members").select("name, domain").eq("member_account_id", body.memberAccountId).maybeSingle(),
        supabase.from("member_accounts").select("name, domain").eq("id", body.memberAccountId).maybeSingle(),
    ]);

    if (latestError) {
        console.error("admin attendance correction: latest lookup failed", latestError);
        return NextResponse.json({ success: false, error: "Could not load this member's attendance." }, { status: 500 });
    }

    if (body.type === "checked_out_at") {
        if (!latest || latest.action !== "IN") {
            return NextResponse.json({ success: false, error: "This member isn't currently checked in." }, { status: 400 });
        }
        if (ts <= Date.parse(latest.occurred_at)) {
            return NextResponse.json({ success: false, error: "Check-out time must be after their check-in." }, { status: 400 });
        }
    } else {
        if (latest && latest.action === "IN") {
            return NextResponse.json({ success: false, error: "This member is already checked in." }, { status: 400 });
        }
        if (latest && ts <= Date.parse(latest.occurred_at)) {
            return NextResponse.json({ success: false, error: "Check-in time must be after their last check-out." }, { status: 400 });
        }
    }

    const name = roster?.name || account?.name || "Unknown";
    const domain = roster?.domain || account?.domain || "GENERAL";
    const action = body.type === "checked_out_at" ? "OUT" : "IN";

    const broadcast = broadcastAttendanceEvent({ event: "tap", name, domain, action });

    const { error: insertError } = await supabase.from("attendance_logs").insert({
        member_account_id: body.memberAccountId,
        action,
        source: "admin_correction",
        occurred_at: new Date(ts).toISOString(),
        note: `Corrected by ${session.user} via admin dashboard`,
    });

    await broadcast;

    if (insertError) {
        console.error("admin attendance correction: insert failed", insertError);
        return NextResponse.json({ success: false, error: "Could not save correction." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
