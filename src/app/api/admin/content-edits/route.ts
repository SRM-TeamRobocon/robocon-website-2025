import { NextResponse } from "next/server";
import { getContentResource, normalizePayload } from "@/lib/content-resources";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { nextGalleryDisplayOrder } from "@/lib/gallery";

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
        .from("content_edits")
        .select("*, member_accounts(name, email)")
        .order("created_at", { ascending: false });

    if (status !== "all") {
        query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
        console.error("admin content-edits list error", error);
        return NextResponse.json({ success: false, error: "Could not load submissions." }, { status: 500 });
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

        const { data: edit, error: fetchError } = await supabase
            .from("content_edits")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (fetchError || !edit) {
            return NextResponse.json({ success: false, error: "Submission not found." }, { status: 404 });
        }

        if (edit.status !== "pending") {
            return NextResponse.json({ success: false, error: "This submission was already reviewed." }, { status: 409 });
        }

        if (decision === "approve") {
            const config = getContentResource(edit.resource);
            if (!config) {
                return NextResponse.json({ success: false, error: "Unknown resource." }, { status: 400 });
            }

            const payload = normalizePayload(config, edit.payload as Record<string, unknown>);

            if (edit.action === "create") {
                if (config.table === "gallery") {
                    payload.display_order = await nextGalleryDisplayOrder(supabase);
                }

                const { error: applyError } = await (supabase.from(config.table) as any).insert(payload);
                if (applyError) {
                    console.error("content-edits approve (create) error", applyError);
                    return NextResponse.json({ success: false, error: "Could not apply this change." }, { status: 500 });
                }
            } else {
                const { error: applyError } = await (supabase.from(config.table) as any)
                    .update(payload)
                    .eq("id", edit.record_id);
                if (applyError) {
                    console.error("content-edits approve (update) error", applyError);
                    return NextResponse.json({ success: false, error: "Could not apply this change." }, { status: 500 });
                }
            }
        }

        const { error: updateError } = await supabase
            .from("content_edits")
            .update({
                status: decision === "approve" ? "approved" : "rejected",
                review_note: reviewNote || null,
                reviewed_by: session.user,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", id);

        if (updateError) {
            console.error("content-edits review update error", updateError);
            return NextResponse.json({ success: false, error: "Could not record decision." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("admin content-edits PATCH error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
