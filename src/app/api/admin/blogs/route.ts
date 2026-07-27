import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { UUID_RE } from "@/lib/blog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    const supabase = createSupabaseAdminClient();
    let query = supabase.from("blogs").select("*").order("created_at", { ascending: false });

    if (status !== "all") {
        query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
        console.error("admin blogs list error", error);
        return NextResponse.json({ success: false, error: "Could not load blogs." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["lead", "admin"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        let body: { id?: unknown; decision?: unknown; reviewNote?: unknown };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
        }

        const { id, decision, reviewNote } = body as { id?: string; decision?: string; reviewNote?: string };
        // "unpublish" is the moderation takedown: it pulls an already-approved post
        // back to pending so it leaves every feed until someone re-approves it.
        const DECISIONS = ["approve", "reject", "unpublish"];
        if (!id || !decision || !DECISIONS.includes(decision)) {
            return NextResponse.json({ success: false, error: "Missing or invalid id/decision." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        const { data: blog, error: fetchError } = await supabase
            .from("blogs")
            .select("id, status")
            .eq("id", id)
            .maybeSingle();

        if (fetchError || !blog) {
            return NextResponse.json({ success: false, error: "Blog not found." }, { status: 404 });
        }

        if (decision === "unpublish") {
            if (blog.status !== "approved") {
                return NextResponse.json({ success: false, error: "Only a live blog can be unpublished." }, { status: 409 });
            }
        } else if (blog.status !== "pending") {
            return NextResponse.json({ success: false, error: "This blog was already reviewed." }, { status: 409 });
        }

        const nextStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "pending";

        const { error: updateError } = await supabase
            .from("blogs")
            .update({
                status: nextStatus,
                published_at: decision === "approve" ? new Date().toISOString() : null,
                review_note: reviewNote || null,
                reviewed_by: session.user,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", id);

        if (updateError) {
            console.error("admin blogs review update error", updateError);
            return NextResponse.json({ success: false, error: "Could not record decision." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("admin blogs PATCH error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

// Moderator takedown: unlike the author-scoped DELETE on /api/member/blogs,
// a lead/admin can remove anyone's post regardless of status or author.
export async function DELETE(request: Request) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id || !UUID_RE.test(id)) {
        return NextResponse.json({ success: false, error: "Blog not found." }, { status: 404 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: existing } = await supabase.from("blogs").select("id").eq("id", id).maybeSingle();
    if (!existing) {
        return NextResponse.json({ success: false, error: "Blog not found." }, { status: 404 });
    }

    const { error } = await supabase.from("blogs").delete().eq("id", id);
    if (error) {
        console.error("admin blogs DELETE error", error);
        return NextResponse.json({ success: false, error: "Could not delete blog." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
