import { NextResponse } from "next/server";
import { getContentResource, normalizePayload } from "@/lib/content-resources";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// "members" (profile) is not here - that's a direct-apply edit via /api/profile now, no approval needed.
const EDITABLE_RESOURCES = new Set(["projects", "achievements", "events", "gallery", "alumni"]);

export async function GET(request: Request) {
    const session = await getSession();
    if (!requireRole(session, ["member"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const supabase = createSupabaseAdminClient();

    if (id) {
        const { data, error } = await supabase
            .from("content_edits")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error || !data) {
            return NextResponse.json({ success: false, error: "Proposal not found." }, { status: 404 });
        }

        const isOwner = data.submitted_by === session.memberAccountId;
        const isPrivileged = session.role === "lead" || session.role === "admin";
        if (!isOwner && !isPrivileged) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabase
        .from("content_edits")
        .select("*")
        .eq("submitted_by", session.memberAccountId!)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("content-edits list error", error);
        return NextResponse.json({ success: false, error: "Could not load submissions." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["member"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const resource = String(body.resource || "");

        if (!EDITABLE_RESOURCES.has(resource)) {
            return NextResponse.json({ success: false, error: "Unknown resource." }, { status: 400 });
        }

        const config = getContentResource(resource);
        if (!config) {
            return NextResponse.json({ success: false, error: "Unknown resource." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        const action: "create" | "update" = body.action === "create" ? "create" : "update";
        const recordId: string | null = action === "update" ? String(body.recordId || "") || null : null;

        if (action === "update") {
            if (!recordId) {
                return NextResponse.json({ success: false, error: "recordId is required to edit an existing item." }, { status: 400 });
            }
            const { data: existing } = await (supabase.from(config.table) as any).select("id").eq("id", recordId).maybeSingle();
            if (!existing) {
                return NextResponse.json({ success: false, error: "That item no longer exists." }, { status: 404 });
            }
        }

        const payload = normalizePayload(config, body.payload || {});

        if (action === "create") {
            for (const field of config.fields) {
                if (field.required && !payload[field.name]) {
                    return NextResponse.json({ success: false, error: `${field.label} is required` }, { status: 400 });
                }
            }
        }

        const { error: insertError } = await supabase.from("content_edits").insert({
            resource,
            record_id: recordId,
            action,
            payload: payload as import("@/lib/supabase/types").Json,
            submitted_by: session.memberAccountId!,
        });

        if (insertError) {
            console.error("content-edits submit error", insertError);
            return NextResponse.json({ success: false, error: "Could not submit proposal." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("content-edits POST error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["member"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const id = String(body.id || "");
        if (!id) {
            return NextResponse.json({ success: false, error: "Proposal ID is required." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        const { data: edit, error: fetchError } = await supabase
            .from("content_edits")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (fetchError || !edit) {
            return NextResponse.json({ success: false, error: "Proposal not found." }, { status: 404 });
        }

        const isOwner = edit.submitted_by === session.memberAccountId;
        const isPrivileged = session.role === "lead" || session.role === "admin";
        if (!isOwner && !isPrivileged) {
            return NextResponse.json({ success: false, error: "You cannot edit someone else's proposal." }, { status: 403 });
        }

        if (edit.status !== "pending") {
            return NextResponse.json({
                success: false,
                error: `This proposal cannot be edited because it has already been ${edit.status}.`,
            }, { status: 409 });
        }

        const config = getContentResource(edit.resource);
        if (!config) {
            return NextResponse.json({ success: false, error: "Unknown resource." }, { status: 400 });
        }

        const payload = normalizePayload(config, body.payload || {});

        if (edit.action === "create") {
            for (const field of config.fields) {
                if (field.required && !payload[field.name]) {
                    return NextResponse.json({ success: false, error: `${field.label} is required` }, { status: 400 });
                }
            }
        }

        const { error: updateError } = await supabase
            .from("content_edits")
            .update({
                payload: payload as import("@/lib/supabase/types").Json,
            })
            .eq("id", id);

        if (updateError) {
            console.error("content-edits update error", updateError);
            return NextResponse.json({ success: false, error: "Could not update proposal." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("content-edits PATCH error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["member"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        let id = searchParams.get("id");
        if (!id) {
            try {
                const body = await request.json();
                id = body.id;
            } catch {}
        }

        if (!id) {
            return NextResponse.json({ success: false, error: "Proposal ID is required." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data: edit, error: fetchError } = await supabase
            .from("content_edits")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (fetchError || !edit) {
            return NextResponse.json({ success: false, error: "Proposal not found." }, { status: 404 });
        }

        const isOwner = edit.submitted_by === session.memberAccountId;
        const isPrivileged = session.role === "lead" || session.role === "admin";
        if (!isOwner && !isPrivileged) {
            return NextResponse.json({ success: false, error: "You cannot withdraw someone else's proposal." }, { status: 403 });
        }

        if (edit.status !== "pending") {
            return NextResponse.json({
                success: false,
                error: `This proposal cannot be withdrawn because it has already been ${edit.status}.`,
            }, { status: 409 });
        }

        const { error: deleteError } = await supabase
            .from("content_edits")
            .delete()
            .eq("id", id);

        if (deleteError) {
            console.error("content-edits delete error", deleteError);
            return NextResponse.json({ success: false, error: "Could not withdraw proposal." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("content-edits DELETE error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
