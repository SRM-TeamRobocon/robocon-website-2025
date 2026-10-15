import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

interface ApprovalHistoryRow {
    id: number;
    approval_type: "member" | "content" | "blog" | "leave";
    subject_id: string;
    subject_label: string;
    decision: "approved" | "rejected";
    approved_by: string;
    approved_by_name: string | null;
    approved_at: string;
}

export async function GET(request: Request) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
    const cursor = searchParams.get("before");
    const supabase = createSupabaseAdminClient();

    let query = supabase
        .from("approval_history")
        .select("id, approval_type, subject_id, subject_label, decision, approved_by, approved_by_name, approved_at")
        .order("approved_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

    if (cursor) query = query.lt("approved_at", cursor);

    const { data, error } = await query;
    if (error) {
        console.error("approval history list error", error);
        return NextResponse.json({ success: false, error: "Could not load approval history." }, { status: 500 });
    }

    const rows = (data || []) as ApprovalHistoryRow[];
    const hasMore = rows.length > limit;
    const history = hasMore ? rows.slice(0, limit) : rows;
    return NextResponse.json(
        {
            success: true,
            history,
            nextBefore: hasMore ? history[history.length - 1]?.approved_at : null,
        },
        { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } }
    );
}
