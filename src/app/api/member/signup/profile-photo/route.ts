import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEMBER_GOOGLE_PENDING_COOKIE, verifyPendingGoogleProfile } from "@/lib/member-oauth";

export const dynamic = "force-dynamic";

const BUCKET = "member-photos";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const pendingGoogle = await verifyPendingGoogleProfile(cookieStore.get(MEMBER_GOOGLE_PENDING_COOKIE)?.value);
    if (!pendingGoogle) {
        return NextResponse.json({ error: "Continue with Google before uploading a profile photo." }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const photo = formData.get("photo");
        if (!(photo instanceof File) || photo.size === 0) {
            return NextResponse.json({ error: "Choose a profile photo." }, { status: 400 });
        }
        if (!EXTENSIONS[photo.type]) {
            return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
        }
        if (photo.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "Profile photos must be 5 MB or smaller." }, { status: 400 });
        }

        const path = `signup/${pendingGoogle.google_uid}/${randomUUID()}.${EXTENSIONS[photo.type]}`;
        const supabase = createSupabaseAdminClient();
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, photo, {
            contentType: photo.type,
            cacheControl: "31536000",
            upsert: false,
        });
        if (uploadError) {
            console.error("member signup profile photo upload error", uploadError);
            return NextResponse.json({ error: "Could not save your profile photo." }, { status: 500 });
        }

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return NextResponse.json({ profilePhotoUrl: data.publicUrl });
    } catch (error) {
        console.error("member signup profile photo request error", error);
        return NextResponse.json({ error: "Could not upload your profile photo." }, { status: 500 });
    }
}
