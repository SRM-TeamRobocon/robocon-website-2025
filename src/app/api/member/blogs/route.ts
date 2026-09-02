import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { slugify, ensureUniqueSlug, sanitizeBlocks, isSlugConflict, UUID_RE } from "@/lib/blog";
import type { Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;

// Reject oversized bodies before parsing: sanitizeBlocks caps what gets stored,
// but without this the route would still buffer a multi-megabyte payload first.
const MAX_BODY_BYTES = 1_000_000;

type ParsedBody = { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse };

async function parseBody(request: Request): Promise<ParsedBody> {
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > MAX_BODY_BYTES) {
        return { ok: false, response: NextResponse.json({ success: false, error: "Blog is too large." }, { status: 413 }) };
    }
    try {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
            return { ok: false, response: NextResponse.json({ success: false, error: "Blog is too large." }, { status: 413 }) };
        }
        return { ok: true, body: JSON.parse(raw) as Record<string, unknown> };
    } catch {
        return { ok: false, response: NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 }) };
    }
}

export async function GET(request: Request) {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const supabase = createSupabaseAdminClient();

    if (id) {
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
        }

        // A lead/admin can load any post by id (to edit it); everyone else only their own.
        const isPrivileged = session.role === "lead" || session.role === "admin";
        let query = supabase.from("blogs").select("*").eq("id", id);
        if (!isPrivileged) {
            query = query.eq("author_username", session.user);
        }
        const { data, error } = await query.maybeSingle();

        if (error) {
            console.error("member blog fetch error", error);
            return NextResponse.json({ success: false, error: "Could not load blog." }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
        }
        return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabase
        .from("blogs")
        .select("*")
        .eq("author_username", session.user)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("member blogs list error", error);
        return NextResponse.json({ success: false, error: "Could not load your blogs." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, [...DASHBOARD_ROLES])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const parsed = await parseBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.body;

        const title = String(body.title || "").trim().slice(0, 200);
        const coverImageUrl = typeof body.coverImageUrl === "string" && body.coverImageUrl.trim() ? body.coverImageUrl.trim() : null;
        const visibility = body.visibility === "private" ? "private" : "public";
        const content = sanitizeBlocks(body.content);

        if (!title) {
            return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
        }
        if (content.length === 0) {
            return NextResponse.json({ success: false, error: "Add at least one block of content." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const baseSlug = slugify(title);

        // Retry on slug collision: ensureUniqueSlug can lose a race with a
        // concurrent insert of the same title.
        for (let attempt = 0; attempt < 5; attempt++) {
            const slug = await ensureUniqueSlug(supabase, baseSlug);

            const { error: insertError } = await supabase.from("blogs").insert({
                title,
                slug,
                cover_image_url: coverImageUrl,
                content: content as unknown as Json,
                visibility,
                submitted_by: session.memberAccountId || null,
                author_username: session.user,
                author_name: session.name || session.user,
            });

            if (!insertError) return NextResponse.json({ success: true, slug });

            if (!isSlugConflict(insertError)) {
                console.error("member blogs submit error", insertError);
                return NextResponse.json({ success: false, error: "Could not submit blog." }, { status: 500 });
            }
        }

        console.error("member blogs submit error: slug contention exhausted", baseSlug);
        return NextResponse.json({ success: false, error: "Could not submit blog. Please try again." }, { status: 503 });
    } catch (error) {
        console.error("member blogs POST error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

// Editing your own blog resubmits it for approval - content that already went live
// shouldn't change without a lead re-reviewing it. The exception is a lead/admin editing
// a post (their own or someone else's) that's already approved: they already have
// approval authority, so their edit keeps the post live instead of pulling it from the
// feed pending re-review.
export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, [...DASHBOARD_ROLES])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const parsed = await parseBody(request);
        if (!parsed.ok) return parsed.response;
        const body = parsed.body;

        const id = String(body.id || "");
        if (!id) {
            return NextResponse.json({ success: false, error: "Missing blog id." }, { status: 400 });
        }
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: "Blog not found." }, { status: 404 });
        }

        const title = String(body.title || "").trim().slice(0, 200);
        const coverImageUrl = typeof body.coverImageUrl === "string" && body.coverImageUrl.trim() ? body.coverImageUrl.trim() : null;
        const visibility = body.visibility === "private" ? "private" : "public";
        const content = sanitizeBlocks(body.content);

        if (!title) {
            return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
        }
        if (content.length === 0) {
            return NextResponse.json({ success: false, error: "Add at least one block of content." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        const { data: existing } = await supabase
            .from("blogs")
            .select("id, author_username, status")
            .eq("id", id)
            .maybeSingle();

        const isPrivileged = session.role === "lead" || session.role === "admin";
        if (!existing || (existing.author_username !== session.user && !isPrivileged)) {
            return NextResponse.json({ success: false, error: "Blog not found." }, { status: 404 });
        }

        const keepLive = isPrivileged && existing.status === "approved";

        const baseUpdate = {
            title,
            cover_image_url: coverImageUrl,
            content: content as unknown as Json,
            visibility,
        };

        const { error: updateError } = await supabase
            .from("blogs")
            .update(
                keepLive
                    ? baseUpdate
                    : {
                          ...baseUpdate,
                          status: "pending",
                          review_note: null,
                          reviewed_by: null,
                          reviewed_at: null,
                          published_at: null,
                      }
            )
            .eq("id", id);

        if (updateError) {
            console.error("member blogs PATCH error", updateError);
            return NextResponse.json({ success: false, error: "Could not update blog." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("member blogs PATCH error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, [...DASHBOARD_ROLES])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ success: false, error: "Missing blog id." }, { status: 400 });
        }
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: "Blog not found." }, { status: 404 });
        }

        const supabase = createSupabaseAdminClient();

        const { data: existing } = await supabase.from("blogs").select("id, author_username").eq("id", id).maybeSingle();
        if (!existing || existing.author_username !== session.user) {
            return NextResponse.json({ success: false, error: "Blog not found." }, { status: 404 });
        }

        const { error } = await supabase.from("blogs").delete().eq("id", id);
        if (error) {
            console.error("member blogs DELETE error", error);
            return NextResponse.json({ success: false, error: "Could not delete blog." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("member blogs DELETE error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
