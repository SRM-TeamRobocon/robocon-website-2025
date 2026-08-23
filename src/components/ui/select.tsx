"use client";

// Custom-styled dropdown to replace native <select> across the dark-themed recruitment
// pages. A native <select>'s OPEN option list is rendered by the OS/browser, not by our
// CSS — on a dark page it shows up as a plain white popup with no way to theme it, which
// reads as broken. This renders its own listbox instead, so it always matches the page.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
    // Matches the sharp red/white/black poster theme (RecruitmentSection, /recruit/register,
    // /recruit/login) — the only accent that also swaps the trigger chrome and popup to a
    // light surface; red/blue above assume the dark-glass card this component was built for.
    sharp: { ring: "focus:ring-red/40", selectedBg: "bg-red/10", check: "text-red" },
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
    const [mounted, setMounted] = useState(false);
    const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLUListElement>(null);
    const listboxId = useId();

    useEffect(() => setMounted(true), []);

    // Dropdown is portaled to <body> (see render below) so it always paints above
    // every ancestor's stacking context — a card, sidebar, or table wrapper with its
    // own z-index/overflow would otherwise trap a merely-child-positioned dropdown
    // and clip or bury it, no matter how high its own z-index is set.
    useLayoutEffect(() => {
        if (!open) return;
        function updateRect() {
            const el = buttonRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            setRect({ top: r.bottom, left: r.left, width: r.width });
        }
        updateRect();
        window.addEventListener("scroll", updateRect, true);
        window.addEventListener("resize", updateRect);
        return () => {
            window.removeEventListener("scroll", updateRect, true);
            window.removeEventListener("resize", updateRect);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        function onPointerDown(e: MouseEvent) {
            const target = e.target as Node;
            if (
                rootRef.current &&
                !rootRef.current.contains(target) &&
                listboxRef.current &&
                !listboxRef.current.contains(target)
            ) {
                setOpen(false);
            }
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
                        ? accent === "sharp"
                            ? "cursor-not-allowed text-black/25"
                            : "cursor-not-allowed text-white/25"
                        : o.value === value
                        ? `${colors.selectedBg} ${accent === "sharp" ? "text-black" : "text-white"}`
                        : accent === "sharp"
                        ? "text-black/70 hover:bg-red/5"
                        : "text-white/80 hover:bg-white/10"
                }`}
            >
                {o.label}
                {o.value === value && <Check className={`h-3.5 w-3.5 shrink-0 ${colors.check}`} />}
            </li>
        );
    }

    return (
        <div ref={rootRef} className="relative min-w-0">
            <button
                ref={buttonRef}
                type="button"
                id={id}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                onClick={() => setOpen((o) => !o)}
                className={cn(
                    accent === "sharp"
                        ? `flex w-full min-w-0 items-center justify-between gap-2 border-2 border-black/15 bg-white py-3 px-4 text-left text-black shadow-sm outline-none transition-all focus:border-red focus:ring-2 ${colors.ring} disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm sm:leading-6`
                        : `flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border-0 bg-white/10 py-3 px-4 text-left text-white shadow-sm ring-1 ring-inset ring-white/15 outline-none transition-all focus:ring-2 focus:ring-inset ${colors.ring} disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm sm:leading-6`,
                    className
                )}
            >
                <span className={`truncate ${selected ? "" : accent === "sharp" ? "text-black/40" : "text-white/40"}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 ${accent === "sharp" ? "text-black/40" : "text-white/40"} transition-transform ${
                        open ? "rotate-180" : ""
                    }`}
                />
            </button>

            {open &&
                mounted &&
                rect &&
                createPortal(
                    <ul
                        ref={listboxRef}
                        role="listbox"
                        id={listboxId}
                        style={{ top: rect.top + 8, left: rect.left, width: rect.width }}
                        className={
                            accent === "sharp"
                                ? "fixed z-[1000] max-h-64 overflow-auto border-2 border-black bg-white py-1 shadow-2xl"
                                : "fixed z-[1000] max-h-64 overflow-auto rounded-xl border border-white/10 bg-[#141418] py-1 shadow-2xl ring-1 ring-white/10"
                        }
                    >
                        {options.length === 0 ? (
                            <li className={`px-4 py-2.5 text-sm ${accent === "sharp" ? "text-black/40" : "text-white/40"}`}>
                                No options
                            </li>
                        ) : groups ? (
                            <>
                                {leadingOptions?.map(renderOption)}
                                {groups.map((group) => (
                                    <li key={group.label} role="presentation">
                                        <p
                                            className={`px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-widest ${
                                                accent === "sharp" ? "text-black/40" : "text-white/30"
                                            }`}
                                        >
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
                    </ul>,
                    document.body
                )}
        </div>
    );
}
