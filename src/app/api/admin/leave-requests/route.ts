import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    const supabase = createSupabaseAdminClient();
    let query = supabase
        .from("leave_requests")
        .select("*, member_accounts(name, email, domain)")
        .order("created_at", { ascending: false });

    if (status !== "all") {
        query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
        console.error("admin leave-requests list error", error);
        return NextResponse.json({ success: false, error: "Could not load leave requests." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["lead", "admin"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const { id, decision, reviewNote } = await request.json();
        if (!id || (decision !== "approve" && decision !== "reject")) {
            return NextResponse.json({ success: false, error: "Missing or invalid id/decision." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        const { data: leaveRequest, error: fetchError } = await supabase
            .from("leave_requests")
            .select("id, status")
            .eq("id", id)
            .maybeSingle();

        if (fetchError || !leaveRequest) {
            return NextResponse.json({ success: false, error: "Leave request not found." }, { status: 404 });
        }

        if (leaveRequest.status !== "pending") {
            return NextResponse.json({ success: false, error: "This request was already reviewed." }, { status: 409 });
        }

        const { error: updateError } = await supabase
            .from("leave_requests")
            .update({
                status: decision === "approve" ? "approved" : "rejected",
                review_note: reviewNote || null,
                reviewed_by: session.user,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", id);

        if (updateError) {
            console.error("leave-requests review update error", updateError);
            return NextResponse.json({ success: false, error: "Could not record decision." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("admin leave-requests PATCH error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
