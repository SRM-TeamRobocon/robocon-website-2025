import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: albums, error: albumsError } = await supabase
        .from("gallery_albums")
        .select("*")
        .order("display_order", { ascending: true });

    if (albumsError) {
        console.error("gallery-albums list error", albumsError);
        return NextResponse.json({ success: false, error: "Could not load albums." }, { status: 500 });
    }

    const { data: photos, error: photosError } = await supabase
        .from("gallery")
        .select("album_id, image_url")
        .order("display_order", { ascending: true });

    if (photosError) {
        console.error("gallery-albums photo count error", photosError);
        return NextResponse.json({ success: false, error: "Could not load albums." }, { status: 500 });
    }

    const data = (albums ?? []).map((album) => {
        const albumPhotos = (photos ?? []).filter((photo) => photo.album_id === album.id);
        return {
            ...album,
            photo_count: albumPhotos.length,
            cover_image_url: albumPhotos[0]?.image_url ?? null,
        };
    });

    return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
        return NextResponse.json({ success: false, error: "Album title is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: last } = await supabase
        .from("gallery_albums")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();

    const { data, error } = await supabase
        .from("gallery_albums")
        .insert({ title, display_order: (last?.display_order ?? -1) + 1 })
        .select("*")
        .single();

    if (error) {
        console.error("gallery-albums create error", error);
        return NextResponse.json({ success: false, error: "Could not create album." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : null;
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!id || !title) {
        return NextResponse.json({ success: false, error: "id and title are required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("gallery_albums").update({ title }).eq("id", id).select("*").single();

    if (error) {
        console.error("gallery-albums update error", error);
        return NextResponse.json({ success: false, error: "Could not rename album." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
        return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("gallery_albums").delete().eq("id", id);

    if (error) {
        console.error("gallery-albums delete error", error);
        return NextResponse.json({ success: false, error: "Could not delete album." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
