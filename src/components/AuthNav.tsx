"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

type Variant = "portal" | "glass" | "sharp";

const VARIANTS = {
    // Matches the gray-900 cards on /login, /signup, /forgot-password, /verify.
    portal:
        "bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 text-gray-300 hover:text-white hover:border-gray-500",
    // Matches the frosted GlassCard used across /recruit/*.
    glass:
        "bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 text-white/80 hover:bg-white/15 hover:text-white",
} as const;

// Pill shape: portal/glass use the original fully-rounded pill.
const SHAPE: Record<keyof typeof VARIANTS, string> = {
    portal: "rounded-full",
    glass: "rounded-full",
};

// Sharp red/white/black theme — matches RecruitmentSection and the redesigned
// recruit-facing pages (login, register, dashboard). No blur, no rounded pill — angular
// clipped corners like the rest of that theme's buttons/cards.
// A CSS `border` doesn't render along a clip-path's angled edge (it only follows the
// original rectangle, leaving the diagonal side gapped), so instead of a border this
// renders as two nested elements: an outer one filled with the border color and padded
// by the border width, and an inner one with the real fill — see the JSX below.
const SHARP_CLIP = "polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)";
const SHARP_OUTER = "group inline-block max-w-[48%] p-[2px] shadow-sm transition-all active:scale-[0.97] bg-black hover:bg-red";
const SHARP_INNER =
    "flex min-w-0 items-center gap-2 px-4 py-2 text-sm font-semibold transition-all bg-white text-black group-hover:bg-red group-hover:text-white";

/**
 * Back + Home pills that sit above an auth card. `onBack` lets multi-step pages
 * walk their own wizard backwards; without it, Back pops browser history and
 * falls back to the home page when this page was opened directly (e.g. from an
 * emailed link, where there is nothing to go back to).
 */
export default function AuthNav({
    variant = "portal",
    onBack,
    backLabel = "Back",
    className = "",
}: {
    variant?: Variant;
    onBack?: () => void;
    backLabel?: string;
    className?: string;
}) {
    const router = useRouter();

    const handleBack = () => {
        if (onBack) {
            onBack();
            return;
        }
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
        } else {
            router.push("/");
        }
    };

    if (variant === "sharp") {
        return (
            <div className={`flex min-w-0 items-center justify-between gap-3 mb-4 ${className}`}>
                <button type="button" onClick={handleBack} className={SHARP_OUTER} style={{ clipPath: SHARP_CLIP }}>
                    <span className={SHARP_INNER} style={{ clipPath: SHARP_CLIP }}>
                        <ArrowLeft className="w-4 h-4" />
                        <span className="truncate">{backLabel}</span>
                    </span>
                </button>
                <Link href="/" className={SHARP_OUTER} style={{ clipPath: SHARP_CLIP }}>
                    <span className={SHARP_INNER} style={{ clipPath: SHARP_CLIP }}>
                        <Home className="w-4 h-4" />
                        <span className="truncate">Home</span>
                    </span>
                </Link>
            </div>
        );
    }

    const pill = `inline-flex items-center gap-2 ${SHAPE[variant]} px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.97] transition-all ${VARIANTS[variant]}`;

    return (
        <div className={`flex items-center justify-between mb-4 ${className}`}>
            <button type="button" onClick={handleBack} className={pill}>
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
            </button>
            <Link href="/" className={pill}>
                <Home className="w-4 h-4" />
                Home
            </Link>
        </div>
    );
}
