/**
 * Upload + chunk + embed a .txt file into the recruit chatbot's knowledge base, without
 * going through the admin UI. Mirrors exactly what POST /api/admin/recruitment/kb/documents
 * does (src/app/api/admin/recruitment/kb/documents/route.ts): upload to the private
 * "recruit-kb" storage bucket, insert a recruit_kb_documents row, chunk the text
 * (same 1000-char / 150-overlap sliding window as src/lib/rag/chunk.ts), embed each
 * chunk with Voyage AI, insert recruit_kb_chunks rows.
 *
 *   npx tsx --env-file=.env.local scripts/ingest-recruit-kb.ts scripts/kb/recruitment-2026.txt
 *
 * Not wired into package.json as a repeatable npm script — this is a one-off content
 * upload, not a repeatable seed. Re-running with the same file creates a second document
 * (documents aren't deduped by filename), so delete the old one from
 * /dashboard/recruitment/knowledge-base first if re-uploading a revision.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { basename } from "path";

const BUCKET = "recruit-kb";
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const VOYAGE_MODEL = "voyage-3.5";
const VOYAGE_OUTPUT_DIMENSION = 1024;

function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + chunkSize, trimmed.length);
    const chunk = trimmed.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= trimmed.length) break;
    start = end - overlap;
  }
  return chunks;
}

async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: "document",
      output_dimension: VOYAGE_OUTPUT_DIMENSION,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const data = json?.data as { embedding: number[] }[] | undefined;
  if (!Array.isArray(data)) throw new Error("Voyage embeddings response was malformed.");
  return data.map((d) => d.embedding);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx --env-file=.env.local scripts/ingest-recruit-kb.ts <path-to-txt-file>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  }
  if (!voyageKey) {
    throw new Error("VOYAGE_API_KEY must be set in .env.local");
  }

  const filename = basename(filePath);
  const text = readFileSync(filePath, "utf-8");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Uploading ${filename} to storage bucket "${BUCKET}"...`);
  const storagePath = `${crypto.randomUUID()}-${filename}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, text, {
    contentType: "text/plain",
    upsert: false,
  });
  if (uploadError) {
    console.error("✗ Storage upload failed", uploadError);
    process.exit(1);
  }

  console.log("Inserting recruit_kb_documents row...");
  const { data: document, error: docError } = await supabase
    .from("recruit_kb_documents")
    .insert({ filename, storage_path: storagePath, uploaded_by: "script:ingest-recruit-kb" })
    .select("id, filename")
    .single();
  if (docError || !document) {
    console.error("✗ recruit_kb_documents insert failed", docError);
    process.exit(1);
  }

  const chunks = chunkText(text);
  console.log(`Chunked into ${chunks.length} pieces. Embedding with Voyage (${VOYAGE_MODEL})...`);

  if (chunks.length > 0) {
    const embeddings = await embedTexts(chunks, voyageKey);
    const rows = chunks.map((content, i) => ({
      document_id: document.id,
      chunk_index: i,
      content,
      embedding: embeddings[i],
    }));

    const { error: chunksError } = await supabase.from("recruit_kb_chunks").insert(rows);
    if (chunksError) {
      console.error("✗ recruit_kb_chunks insert failed", chunksError);
      process.exit(1);
    }
  }

  console.log("");
  console.log(`✓ Done — "${document.filename}" ingested as ${chunks.length} chunk(s) (document id: ${document.id})`);
}

main().catch((error) => {
  console.error("\n✗ Ingestion failed");
  console.error(error);
  process.exit(1);
});
