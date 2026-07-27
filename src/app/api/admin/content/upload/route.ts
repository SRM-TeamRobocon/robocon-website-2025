import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

const ALLOWED_BUCKETS = new Set(["member-photos", "gallery", "event-posters", "project-covers", "achievement-images", "media", "blog-images"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const bucket = String(formData.get("bucket") || "media");
  const folder = String(formData.get("folder") || "uploads").replace(/[^a-z0-9/_-]/gi, "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Unknown storage bucket" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, GIF, or AVIF images are allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds 8MB limit" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const extension = file.name.split(".").pop() || "bin";
  const pathname = `${folder}/${crypto.randomUUID()}.${extension}`;
  const bytes = await file.arrayBuffer();

  const { error } = await supabase.storage.from(bucket).upload(pathname, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(pathname);

  return NextResponse.json({ publicUrl: data.publicUrl, path: pathname, bucket });
}
