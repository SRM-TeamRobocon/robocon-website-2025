import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { OAUTH_STATE_COOKIE, verifyOAuthState } from "@/lib/recruit-session";
import { optimizeUploadedImage } from "@/lib/optimize-uploaded-image";

export const dynamic = "force-dynamic";

const BUCKET = "recruit-profile-photos";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
export async function POST(request: Request) {
    const cookieStore = await cookies();
    const state = await verifyOAuthState(cookieStore.get(OAUTH_STATE_COOKIE)?.value);
    if (!state?.google_uid) {
        return NextResponse.json({ error: "Sign in with Google before uploading a photo." }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const photo = formData.get("photo");
        if (!(photo instanceof File) || photo.size === 0) {
            return NextResponse.json({ error: "Choose a profile photo." }, { status: 400 });
        }
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
            return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
        }
        if (photo.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "Profile photos must be 5 MB or smaller." }, { status: 400 });
        }

        const optimized = await optimizeUploadedImage(photo, 1200);
        const path = `${state.google_uid}/${randomUUID()}.${optimized.extension}`;
        const supabase = createRecruitSupabaseAdminClient();
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, optimized.bytes, {
            contentType: optimized.contentType,
            cacheControl: "31536000",
            upsert: false,
        });
        if (uploadError) {
            console.error("profile photo upload error", uploadError);
            return NextResponse.json({ error: "Could not save your profile photo." }, { status: 500 });
        }

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return NextResponse.json({ profile_photo_url: data.publicUrl });
    } catch (error) {
        console.error("profile photo request error", error);
        return NextResponse.json({ error: "Could not upload your profile photo." }, { status: 500 });
    }
}
