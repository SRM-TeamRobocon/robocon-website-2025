import "server-only";

import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";

const BUCKET = "recruit-kb";

// Not a reuse of /api/admin/content/upload — that route is image-only and always
// public. This bucket is private (admin-only knowledge-base .txt files, never served
// directly to a client), so there's no getPublicUrl() call; reads happen via
// .download() from the service-role client, inside the ingestion route only.
export async function uploadKbFile(file: File): Promise<{ storagePath: string }> {
    const supabase = createRecruitSupabaseAdminClient();
    const storagePath = `${crypto.randomUUID()}-${file.name}`;

    const bytes = await file.arrayBuffer();
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
        contentType: "text/plain",
        upsert: false,
    });

    if (error) {
        throw new Error(`Could not upload knowledge base file: ${error.message}`);
    }

    return { storagePath };
}

export async function downloadKbFileText(storagePath: string): Promise<string> {
    const supabase = createRecruitSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);

    if (error || !data) {
        throw new Error(`Could not read knowledge base file: ${error?.message ?? "not found"}`);
    }

    return data.text();
}

export async function deleteKbFile(storagePath: string): Promise<void> {
    const supabase = createRecruitSupabaseAdminClient();
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) {
        throw new Error(`Could not delete knowledge base file: ${error.message}`);
    }
}
