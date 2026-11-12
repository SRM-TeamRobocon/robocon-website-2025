import sharp from "sharp";

const ORIGINAL_FORMATS: Record<string, { contentType: string; extension: string }> = {
  jpeg: { contentType: "image/jpeg", extension: "jpg" },
  png: { contentType: "image/png", extension: "png" },
  webp: { contentType: "image/webp", extension: "webp" },
  gif: { contentType: "image/gif", extension: "gif" },
  avif: { contentType: "image/avif", extension: "avif" },
};

export async function optimizeUploadedImage(
  file: File,
  maxDimension: number
): Promise<{ bytes: Buffer; contentType: string; extension: string }> {
  const original = Buffer.from(await file.arrayBuffer());
  const fallback = ORIGINAL_FORMATS[file.type.replace("image/", "")] ?? {
    contentType: file.type,
    extension: "img",
  };

  try {
    const metadata = await sharp(original).metadata();
    if (!metadata.format || (metadata.pages ?? 1) > 1) {
      return { bytes: original, ...fallback };
    }

    const optimized = await sharp(original).rotate().resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    }).webp({ quality: 80 }).toBuffer();

    return optimized.length < original.length
      ? { bytes: optimized, contentType: "image/webp", extension: "webp" }
      : { bytes: original, ...fallback };
  } catch {
    return { bytes: original, ...fallback };
  }
}
