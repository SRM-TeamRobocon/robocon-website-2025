"use client";

import { useState } from "react";
import type { ContentField } from "@/lib/content-resources";

type Row = Record<string, any>;

function valueForInput(field: ContentField, row: Row) {
    const value = row[field.name];
    if (field.type === "tags") return Array.isArray(value) ? value.join(", ") : value ?? "";
    if (field.type === "datetime" && typeof value === "string") return value.slice(0, 16);
    return value ?? "";
}

interface ContentEditFormProps {
    fields: ContentField[];
    initialValues?: Row;
    submitLabel?: string;
    submitting?: boolean;
    onSubmit: (payload: Row) => void;
}

export default function ContentEditForm({ fields, initialValues = {}, submitLabel = "Submit", submitting, onSubmit }: ContentEditFormProps) {
    const [values, setValues] = useState<Row>(() => {
        const initial: Row = {};
        for (const field of fields) initial[field.name] = valueForInput(field, initialValues);
        return initial;
    });

    const setField = (name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(values);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map((field) => (
                <div key={field.name}>
                    <label className="block text-sm font-medium leading-6 text-gray-300 mb-2">
                        {field.label}
                        {field.required && <span className="text-red ml-1">*</span>}
                    </label>

                    {field.type === "textarea" ? (
                        <textarea
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            rows={4}
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : field.type === "boolean" ? (
                        <input
                            type="checkbox"
                            checked={Boolean(values[field.name])}
                            onChange={(e) => setField(field.name, e.target.checked)}
                            className="h-5 w-5 rounded border-white/20 bg-white/5"
                        />
                    ) : field.type === "number" ? (
                        <input
                            type="number"
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : field.type === "date" ? (
                        <input
                            type="date"
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : field.type === "datetime" ? (
                        <input
                            type="datetime-local"
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : field.type === "tags" ? (
                        <input
                            type="text"
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            placeholder="Comma-separated"
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    ) : (
                        <input
                            type="text"
                            required={field.required}
                            value={values[field.name] ?? ""}
                            onChange={(e) => setField(field.name, e.target.value)}
                            placeholder={field.type === "url" ? "https://..." : undefined}
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 text-sm transition-all"
                        />
                    )}
                </div>
            ))}

            <button
                type="submit"
                disabled={submitting}
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all ${
                    submitting
                        ? "bg-blue-600/50 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                }`}
            >
                {submitting ? "Submitting..." : submitLabel}
            </button>
        </form>
    );
}
