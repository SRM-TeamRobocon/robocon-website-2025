import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, BazaarError } from "@/lib/bazaar/errors";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB limit per spec

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("BAZAAR_VALIDATION", "No file uploaded", 400);
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return jsonError(
        "BAZAAR_VALIDATION",
        "Only JPEG, PNG, or WebP images are allowed",
        400
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return jsonError("BAZAAR_VALIDATION", "File exceeds 2 MB limit", 400);
    }

    const supabase = getBazaarDb();
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const filename = `${crypto.randomUUID()}.${extension}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("bazaar-items")
      .upload(filename, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return jsonError("BAZAAR_INTERNAL", uploadError.message, 500);
    }

    const { data } = supabase.storage.from("bazaar-items").getPublicUrl(filename);

    return NextResponse.json({ url: data.publicUrl, path: filename });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
