"use client";

import { useState } from "react";
import type { ContentField, ContentResourceConfig } from "@/lib/content-resources";
import { ImageOff, Upload, X } from "lucide-react";

export const IMAGE_URL_FIELDS = new Set(["photo_url", "cover_image_url", "image_url"]);
export const IMAGE_ARRAY_FIELDS = new Set(["gallery_urls"]);

export function uploadTarget(resource: string, field: string) {
  if (resource === "members" && field === "photo_url") return { bucket: "member-photos", folder: "members" };
  if (resource === "alumni" && field === "photo_url") return { bucket: "member-photos", folder: "alumni" };
  if (resource === "projects" && field === "cover_image_url") return { bucket: "project-covers", folder: "projects" };
  if (resource === "projects" && field === "gallery_urls") return { bucket: "project-covers", folder: "projects/gallery" };
  if (resource === "events" && field === "cover_image_url") return { bucket: "event-posters", folder: "events" };
  if (resource === "events" && field === "gallery_urls") return { bucket: "event-posters", folder: "events/gallery" };
  if (resource === "achievements" && field === "cover_image_url") return { bucket: "achievement-images", folder: "achievements" };
  if (resource === "achievements" && field === "gallery_urls") return { bucket: "achievement-images", folder: "achievements/gallery" };
  if (resource === "gallery" && field === "image_url") return { bucket: "gallery", folder: "gallery" };

  return null;
}

export function findImageField(config: ContentResourceConfig): ContentField | null {
  return config.fields.find((field) => IMAGE_URL_FIELDS.has(field.name)) || null;
}

export async function uploadImageFile(file: File, target: { bucket: string; folder: string }) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("bucket", target.bucket);
  formData.set("folder", target.folder);

  const response = await fetch("/api/admin/content/upload", { method: "POST", body: formData });
  const json = await response.json();

  if (!response.ok) throw new Error(json.error || "Upload failed");
  return json.publicUrl as string;
}

export function Thumb({ src, alt, size = 48 }: { src: string | null | undefined; alt: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };

  if (!src || broken) {
    return (
      <div
        style={style}
        className="flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-600"
      >
        <ImageOff size={Math.round(size * 0.4)} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={style}
      onError={() => setBroken(true)}
      className="shrink-0 rounded-lg border border-white/10 object-cover"
    />
  );
}

export function SingleImageField({
  field,
  value,
  onChange,
  onUpload,
  uploading,
}: {
  field: ContentField;
  value: string;
  onChange: (value: string) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  return (
    <div className="mt-2 flex items-start gap-3">
      <Thumb src={value} alt={field.label} size={64} />
      <div className="min-w-0 flex-1 space-y-2">
        <input
          type="text"
          required={field.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste an image URL or upload below"
          className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none transition focus:border-red"
        />
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20">
          <Upload size={12} />
          {uploading ? "Uploading..." : value ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

export function MultiImageField({
  field,
  values,
  onChange,
  onUploadFiles,
  uploading,
}: {
  field: ContentField;
  values: string[];
  onChange: (values: string[]) => void;
  onUploadFiles: (files: FileList) => void;
  uploading: boolean;
}) {
  return (
    <div className="mt-2 space-y-2">
      {values.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {values.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative">
              <Thumb src={url} alt={`${field.label} ${index + 1}`} size={72} />
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-red p-1 text-white opacity-0 shadow transition group-hover:opacity-100"
                aria-label={`Remove image ${index + 1}`}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20">
        <Upload size={12} />
        {uploading ? "Uploading..." : "Add images"}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(event) => {
            if (event.target.files?.length) onUploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
