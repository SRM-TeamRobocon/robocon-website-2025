import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!session.memberAccountId) {
        return NextResponse.json({ success: false, error: "This login has no linked member account." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("member_account_id", session.memberAccountId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("leave-requests list error", error);
        return NextResponse.json({ success: false, error: "Could not load your leave requests." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, [...DASHBOARD_ROLES])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        if (!session.memberAccountId) {
            return NextResponse.json({ success: false, error: "This login has no linked member account." }, { status: 400 });
        }

        const body = await request.json();
        const startDate = String(body.startDate || "");
        const endDate = String(body.endDate || startDate);
        const startTime = body.startTime ? String(body.startTime) : null;
        const endTime = body.endTime ? String(body.endTime) : null;
        const reason = String(body.reason || "").trim();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            return NextResponse.json({ success: false, error: "A valid start and end date are required." }, { status: 400 });
        }
        if (endDate < startDate) {
            return NextResponse.json({ success: false, error: "End date can't be before the start date." }, { status: 400 });
        }
        if ((startTime && !TIME_RE.test(startTime)) || (endTime && !TIME_RE.test(endTime))) {
            return NextResponse.json({ success: false, error: "Invalid time format." }, { status: 400 });
        }
        if (startTime && endTime && startDate === endDate && endTime <= startTime) {
            return NextResponse.json({ success: false, error: "End time must be after start time." }, { status: 400 });
        }
        if (!reason) {
            return NextResponse.json({ success: false, error: "A reason is required." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { error: insertError } = await supabase.from("leave_requests").insert({
            member_account_id: session.memberAccountId,
            owner_name: session.name || session.user,
            domain: session.domain || null,
            start_date: startDate,
            end_date: endDate,
            start_time: startTime,
            end_time: endTime,
            reason,
        });

        if (insertError) {
            console.error("leave-requests submit error", insertError);
            return NextResponse.json({ success: false, error: "Could not submit leave request." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("leave-requests POST error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
