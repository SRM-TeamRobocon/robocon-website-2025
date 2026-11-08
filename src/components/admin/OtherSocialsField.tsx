"use client";

import React, { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

export interface OtherSocialLink {
    name: string;
    url: string;
}

interface OtherSocialsFieldProps {
    value?: OtherSocialLink[] | unknown;
    onChange: (links: OtherSocialLink[]) => void;
}

export default function OtherSocialsField({ value, onChange }: OtherSocialsFieldProps) {
    const links: OtherSocialLink[] = useMemo(() => {
        if (Array.isArray(value)) return value;
        if (typeof value === "string" && value.trim()) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed;
            } catch {}
        }
        return [];
    }, [value]);

    const handleAdd = () => {
        onChange([...links, { name: "", url: "" }]);
    };

    const handleUpdate = (index: number, field: "name" | "url", text: string) => {
        const updated = links.map((item, i) => {
            if (i === index) {
                return { ...item, [field]: text };
            }
            return item;
        });
        onChange(updated);
    };

    const handleRemove = (index: number) => {
        onChange(links.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-3">
            {links.length > 0 && (
                <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">
                        <span>Platform / Heading</span>
                        <span>Account Link</span>
                        <span className="w-8"></span>
                    </div>
                    {links.map((link, index) => (
                        <div key={index} className="grid grid-cols-[1fr_1.5fr_auto] gap-2 items-center">
                            <input
                                type="text"
                                placeholder="e.g. GitHub, X, Portfolio"
                                value={link.name || ""}
                                onChange={(e) => handleUpdate(index, "name", e.target.value)}
                                className="w-full border-0 bg-white/5 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-red text-sm transition-all outline-none"
                            />
                            <input
                                type="url"
                                placeholder="https://..."
                                value={link.url || ""}
                                onChange={(e) => handleUpdate(index, "url", e.target.value)}
                                className="w-full border-0 bg-white/5 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-red text-sm transition-all outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => handleRemove(index)}
                                title="Remove"
                                aria-label="Remove link"
                                className="p-2 text-gray-400 hover:text-red hover:bg-white/5 transition-colors shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div>
                <button
                    type="button"
                    onClick={handleAdd}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red border border-red/40 bg-red/10 hover:bg-red/20 hover:border-red transition-all cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    <span>Other</span>
                </button>
            </div>
        </div>
    );
}

