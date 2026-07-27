import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { slug } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("blogs")
        .select("id, title, slug, cover_image_url, content, visibility, author_name, published_at, created_at")
        .eq("slug", slug)
        .eq("status", "approved")
        .maybeSingle();

    if (error) {
        console.error("dashboard blog detail error", error);
        return NextResponse.json({ success: false, error: "Could not load blog." }, { status: 500 });
    }
    if (!data) {
        return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
}
