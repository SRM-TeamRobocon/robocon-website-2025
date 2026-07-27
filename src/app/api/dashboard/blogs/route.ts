import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// Internal feed: every approved blog (public + private) visible to any logged-in
// dashboard user. Public visitors never hit this route — see /api/blogs for that.
export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("blogs")
        .select("id, title, slug, cover_image_url, content, visibility, author_name, published_at, created_at")
        .eq("status", "approved")
        .order("published_at", { ascending: false });

    if (error) {
        console.error("dashboard blogs list error", error);
        return NextResponse.json({ success: false, error: "Could not load blogs." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}
