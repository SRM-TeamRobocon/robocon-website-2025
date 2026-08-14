import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { deleteKbFile } from "@/lib/supabase/recruit-kb-storage";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/admin/recruitment/kb/documents/:id — removes the Storage object and the
// document row (recruit_kb_chunks cascade-deletes with it).
export async function DELETE(_request: Request, context: RouteContext) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createRecruitSupabaseAdminClient();

    const { data: document, error: findError } = await supabase
        .from("recruit_kb_documents")
        .select("id, storage_path")
        .eq("id", id)
        .maybeSingle();

    if (findError) {
        console.error("kb document delete: lookup error", findError);
        return NextResponse.json({ error: "Could not load document" }, { status: 500 });
    }
    if (!document) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    try {
        await deleteKbFile(document.storage_path);
    } catch (err) {
        // Non-fatal — proceed to delete the row anyway rather than leaving an orphaned
        // document a lead can't remove because Storage cleanup failed.
        console.error("kb document delete: storage cleanup error", err);
    }

    const { error: deleteError } = await supabase.from("recruit_kb_documents").delete().eq("id", id);
    if (deleteError) {
        console.error("kb document delete error", deleteError);
        return NextResponse.json({ error: "Could not delete document" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
