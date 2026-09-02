import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { uploadKbFile, downloadKbFileText } from "@/lib/supabase/recruit-kb-storage";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embeddings";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

// GET /api/admin/recruitment/kb/documents - list uploaded knowledge-base files with a
// chunk count each, for the admin KB page.
export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createRecruitSupabaseAdminClient();
    const { data: documents, error } = await supabase
        .from("recruit_kb_documents")
        .select("id, filename, uploaded_by, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("kb documents GET error", error);
        return NextResponse.json({ error: "Could not load documents" }, { status: 500 });
    }

    const ids = (documents ?? []).map((d) => d.id as string);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
        const { data: chunks, error: chunksError } = await supabase
            .from("recruit_kb_chunks")
            .select("document_id")
            .in("document_id", ids);
        if (chunksError) {
            console.error("kb documents GET: chunk count error", chunksError);
        } else {
            for (const c of chunks ?? []) {
                counts.set(c.document_id as string, (counts.get(c.document_id as string) ?? 0) + 1);
            }
        }
    }

    const data = (documents ?? []).map((d) => ({ ...d, chunk_count: counts.get(d.id as string) ?? 0 }));
    return NextResponse.json({ data });
}

// POST /api/admin/recruitment/kb/documents - upload a .txt file, chunk it, embed the
// chunks, and store them. If embedding fails partway through, the document row can end
// up with 0/partial chunks - the admin KB page surfaces chunk_count so a broken upload
// is visibly obvious and can be deleted/re-uploaded (no transactional rollback across
// the external Voyage API call).
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".txt")) {
        return NextResponse.json({ error: "Only .txt files are allowed" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File exceeds 2MB limit" }, { status: 400 });
    }

    const supabase = createRecruitSupabaseAdminClient();

    let storagePath: string;
    try {
        ({ storagePath } = await uploadKbFile(file));
    } catch (err) {
        console.error("kb upload error", err);
        return NextResponse.json({ error: "Could not upload file" }, { status: 500 });
    }

    const { data: document, error: docError } = await supabase
        .from("recruit_kb_documents")
        .insert({ filename: file.name, storage_path: storagePath, uploaded_by: session.user })
        .select("id, filename, uploaded_by, created_at")
        .single();

    if (docError || !document) {
        console.error("kb documents POST: insert error", docError);
        return NextResponse.json({ error: "Could not save document" }, { status: 500 });
    }

    try {
        const text = await downloadKbFileText(storagePath);
        const chunks = chunkText(text);

        if (chunks.length > 0) {
            const embeddings = await embedTexts(chunks, "document");
            const rows = chunks.map((content, i) => ({
                document_id: document.id,
                chunk_index: i,
                content,
                embedding: embeddings[i],
            }));

            const { error: chunksError } = await supabase.from("recruit_kb_chunks").insert(rows);
            if (chunksError) {
                console.error("kb documents POST: chunk insert error", chunksError);
                return NextResponse.json(
                    { data: { ...document, chunk_count: 0 }, warning: "Uploaded, but chunks failed to save. Delete and retry." },
                    { status: 201 }
                );
            }
        }

        return NextResponse.json({ data: { ...document, chunk_count: chunks.length } }, { status: 201 });
    } catch (err) {
        console.error("kb documents POST: ingestion error", err);
        return NextResponse.json(
            { data: { ...document, chunk_count: 0 }, warning: "Uploaded, but embedding failed. Delete and retry." },
            { status: 201 }
        );
    }
}
