import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type BlogVisibility = "public" | "private";
export type BlogStatus = "pending" | "approved" | "rejected";

export type BlogBlock =
    | { type: "heading"; text: string }
    | { type: "paragraph"; text: string }
    | { type: "image"; url: string; caption?: string };

export interface BlogRow {
    id: string;
    title: string;
    slug: string;
    cover_image_url: string | null;
    content: BlogBlock[];
    visibility: string;
    status: string;
    author_username: string;
    author_name: string;
    review_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    published_at: string | null;
    created_at: string;
}

// Postgres rejects a non-UUID string for a uuid column with a hard error, so
// routes must screen ids themselves rather than let the query 500.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function slugify(title: string): string {
    const base = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
        .replace(/-+$/g, "");
    return base || "post";
}

export async function ensureUniqueSlug(
    supabase: SupabaseClient<Database>,
    baseSlug: string
): Promise<string> {
    let candidate = baseSlug;
    let suffix = 2;

    while (suffix < 500) {
        const { data } = await supabase.from("blogs").select("id").eq("slug", candidate).maybeSingle();
        if (!data) return candidate;
        candidate = `${baseSlug}-${suffix}`;
        suffix += 1;
    }
    // Pathological case (hundreds of identical titles): fall back to a unique suffix.
    return `${baseSlug}-${Date.now().toString(36)}`;
}

// Postgres unique-violation on blogs.slug. Two authors posting the same title at
// the same moment both pass the ensureUniqueSlug check, so the insert itself has
// to be retried rather than surfaced as a generic failure.
export function isSlugConflict(error: { code?: string | null; message?: string | null } | null): boolean {
    if (!error) return false;
    return error.code === "23505" || Boolean(error.message && error.message.includes("blogs_slug_key"));
}

const MAX_BLOCKS = 60;
const MAX_HEADING_LENGTH = 150;
const MAX_PARAGRAPH_LENGTH = 8000;

// Trims and drops empty/malformed blocks so bad client input can't corrupt stored content.
export function sanitizeBlocks(input: unknown): BlogBlock[] {
    if (!Array.isArray(input)) return [];

    const blocks: BlogBlock[] = [];
    for (const raw of input.slice(0, MAX_BLOCKS)) {
        if (!raw || typeof raw !== "object") continue;
        const block = raw as Record<string, unknown>;

        if (block.type === "heading" && typeof block.text === "string") {
            const text = block.text.trim().slice(0, MAX_HEADING_LENGTH);
            if (text) blocks.push({ type: "heading", text });
        } else if (block.type === "paragraph" && typeof block.text === "string") {
            const text = block.text.trim().slice(0, MAX_PARAGRAPH_LENGTH);
            if (text) blocks.push({ type: "paragraph", text });
        } else if (block.type === "image" && typeof block.url === "string" && block.url.trim()) {
            const caption = typeof block.caption === "string" ? block.caption.trim().slice(0, 300) : undefined;
            blocks.push({ type: "image", url: block.url.trim(), ...(caption ? { caption } : {}) });
        }
    }
    return blocks;
}

export function getBlogExcerpt(blocks: BlogBlock[], maxLength = 160): string {
    const firstText = blocks.find((b) => b.type === "paragraph" || b.type === "heading") as
        | { text: string }
        | undefined;
    if (!firstText) return "";
    const text = firstText.text;
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
