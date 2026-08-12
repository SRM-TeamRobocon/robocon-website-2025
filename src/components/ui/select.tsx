"use client";

// Custom-styled dropdown to replace native <select> across the dark-themed recruitment
// pages. A native <select>'s OPEN option list is rendered by the OS/browser, not by our
// CSS — on a dark page it shows up as a plain white popup with no way to theme it, which
// reads as broken. This renders its own listbox instead, so it always matches the page.

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

const ACCENTS = {
    // Matches GlassCard / recruit pages.
    red: { ring: "focus:ring-red/50", selectedBg: "bg-red/15", check: "text-red" },
    // Matches the bg-gray-900 "portal" pages (/login, /signup, /forgot-password).
    blue: { ring: "focus:ring-blue-500", selectedBg: "bg-blue-500/15", check: "text-blue-400" },
} as const;

export interface SelectGroup {
    label: string;
    options: SelectOption[];
}

export default function Select({
    value,
    onChange,
    options,
    groups,
    leadingOptions,
    placeholder = "Select...",
    id,
    className = "",
    disabled = false,
    accent = "red",
}: {
    value: string;
    onChange: (value: string) => void;
    // Flat list — always required, used for the "currently selected" label lookup even
    // when `groups` supplies the grouped rendering.
    options: SelectOption[];
    // Optional grouped rendering (optgroup equivalent). `leadingOptions` render flat,
    // above the groups (e.g. an "All domains" catch-all that isn't part of any group);
    // `leadingOptions` + every group's options together should equal `options`.
    groups?: SelectGroup[];
    leadingOptions?: SelectOption[];
    placeholder?: string;
    id?: string;
    className?: string;
    disabled?: boolean;
    accent?: keyof typeof ACCENTS;
}) {
    const colors = ACCENTS[accent];
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const listboxId = useId();

    useEffect(() => {
        if (!open) return;
        function onPointerDown(e: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const selected = options.find((o) => o.value === value);

    function renderOption(o: SelectOption) {
        return (
            <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled}
                onClick={() => {
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                }}
                className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    o.disabled
                        ? "cursor-not-allowed text-white/25"
                        : o.value === value
                        ? `${colors.selectedBg} text-white`
                        : "text-white/80 hover:bg-white/10"
                }`}
            >
                {o.label}
                {o.value === value && <Check className={`h-3.5 w-3.5 shrink-0 ${colors.check}`} />}
            </li>
        );
    }

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                id={id}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                onClick={() => setOpen((o) => !o)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border-0 bg-white/10 py-3 px-4 text-left text-white shadow-sm ring-1 ring-inset ring-white/15 outline-none transition-all focus:ring-2 focus:ring-inset ${colors.ring} disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm sm:leading-6 ${className}`}
            >
                <span className={`truncate ${selected ? "" : "text-white/40"}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <ul
                    role="listbox"
                    id={listboxId}
                    className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-white/10 bg-[#141418] py-1 shadow-2xl ring-1 ring-white/10"
                >
                    {options.length === 0 ? (
                        <li className="px-4 py-2.5 text-sm text-white/40">No options</li>
                    ) : groups ? (
                        <>
                            {leadingOptions?.map(renderOption)}
                            {groups.map((group) => (
                                <li key={group.label} role="presentation">
                                    <p className="px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
                                        {group.label}
                                    </p>
                                    <ul role="group" aria-label={group.label}>
                                        {group.options.map(renderOption)}
                                    </ul>
                                </li>
                            ))}
                        </>
                    ) : (
                        options.map(renderOption)
                    )}
                </ul>
            )}
        </div>
    );
}
