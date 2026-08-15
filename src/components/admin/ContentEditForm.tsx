"use client";

import { useState } from "react";
import type { ContentField } from "@/lib/content-resources";
import {
    IMAGE_URL_FIELDS,
    IMAGE_ARRAY_FIELDS,
    uploadTarget,
    uploadImageFile,
    SingleImageField,
    MultiImageField,
} from "@/components/ContentImageFields";

type Row = Record<string, any>;

function valueForInput(field: ContentField, row: Row) {
    const value = row[field.name];
    if (IMAGE_ARRAY_FIELDS.has(field.name)) return Array.isArray(value) ? value : [];
    if (field.type === "tags") return Array.isArray(value) ? value.join(", ") : value ?? "";
    if (field.type === "datetime" && typeof value === "string") return value.slice(0, 16);
    return value ?? "";
}

interface ContentEditFormProps {
    fields: ContentField[];
    initialValues?: Row;
    submitLabel?: string;
    submitting?: boolean;
    /** Resource key (e.g. "gallery", "projects") — enables the upload button for image fields. */
    resource?: string;
    onSubmit: (payload: Row) => void;
}

export default function ContentEditForm({ fields, initialValues = {}, submitLabel = "Submit", submitting, resource, onSubmit }: ContentEditFormProps) {
    const [values, setValues] = useState<Row>(() => {
        const initial: Row = {};
        for (const field of fields) initial[field.name] = valueForInput(field, initialValues);
        return initial;
    });
    const [uploadingField, setUploadingField] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState("");

    const setField = (name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(values);
    };

    async function uploadSingle(field: ContentField, file: File) {
        const target = resource && uploadTarget(resource, field.name);
        if (!target) return;

        setUploadingField(field.name);
        setUploadError("");
        try {
            const publicUrl = await uploadImageFile(file, target);
            setField(field.name, publicUrl);
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadingField(null);
        }
    }

    async function uploadMultiple(field: ContentField, files: FileList) {
        const target = resource && uploadTarget(resource, field.name);
        if (!target) return;

        setUploadingField(field.name);
        setUploadError("");
        try {
            const uploaded = await Promise.all(Array.from(files).map((file) => uploadImageFile(file, target)));
            const current: string[] = Array.isArray(values[field.name]) ? values[field.name] : [];
            setField(field.name, [...current, ...uploaded]);
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadingField(null);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map((field) => (
                <div key={field.name}>
                    <label className="block text-sm font-medium leading-6 text-gray-300 mb-2">
                        {field.label}
                        {field.required && <span className="text-red ml-1">*</span>}
                    </label>

                    {resource && IMAGE_URL_FIELDS.has(field.name) && uploadTarget(resource, field.name) ? (
                        <SingleImageField
                            field={field}
                            value={values[field.name] ?? ""}
                            onChange={(next) => setField(field.name, next)}
                            onUpload={(file) => uploadSingle(field, file)}
                            uploading={uploadingField === field.name}
                        />
                    ) : resource && IMAGE_ARRAY_FIELDS.has(field.name) && uploadTarget(resource, field.name) ? (
                        <MultiImageField
                            field={field}
                            values={Array.isArray(values[field.name]) ? values[field.name] : []}
                            onChange={(next) => setField(field.name, next)}
                            onUploadFiles={(files) => uploadMultiple(field, files)}
                            uploading={uploadingField === field.name}
                        />
                    ) : field.type === "textarea" ? (
                        <textarea
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            rows={4}
                            className="block w-full border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : field.type === "boolean" ? (
                        <input
                            type="checkbox"
                            checked={Boolean(values[field.name])}
                            onChange={(e) => setField(field.name, e.target.checked)}
                            className="h-5 w-5 border-white/20 bg-white/5"
                        />
                    ) : field.type === "number" ? (
                        <input
                            type="number"
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            className="block w-full border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : field.type === "date" ? (
                        <input
                            type="date"
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            className="block w-full border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : field.type === "datetime" ? (
                        <input
                            type="datetime-local"
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            className="block w-full border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : field.type === "tags" ? (
                        <input
                            type="text"
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            placeholder="Comma-separated"
                            className="block w-full border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : (
                        <input
                            type="text"
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            placeholder={field.type === "url" ? "https://..." : undefined}
                            className="block w-full border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    )}
                </div>
            ))}

            {uploadError && (
                <p className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">{uploadError}</p>
            )}

            <button
                type="submit"
                disabled={submitting}
                className={`group relative w-full overflow-hidden px-8 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] ${
                    submitting
                        ? "bg-blue-600/50 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                }`}
                style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
            >
                <span
                    className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                    style={{
                        clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                        backgroundColor: "#D4AF37",
                    }}
                />
                <span className="relative z-10 transition-colors duration-200 group-hover:text-black">
                    {submitting ? "Submitting..." : submitLabel}
                </span>
            </button>
        </form>
    );
}
