"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

const VARIANTS = {
    // Matches the gray-900 cards on /login, /signup, /forgot-password, /verify.
    portal:
        "bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 text-gray-300 hover:text-white hover:border-gray-500",
    // Matches the frosted GlassCard used across /recruit/*.
    glass:
        "bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 text-white/80 hover:bg-white/15 hover:text-white",
    // Sharp red/white/black theme — matches RecruitmentSection and the redesigned
    // recruit-facing pages (login, register, dashboard). No blur, no rounded pill —
    // angular clipped corners like the rest of that theme's buttons/cards.
    sharp:
        "bg-white border-2 border-black text-black hover:bg-red hover:text-white hover:border-red",
} as const;

// Pill shape differs per variant: portal/glass use the original fully-rounded pill,
// sharp uses a small angled clip like the buttons/cards elsewhere in that theme.
const SHAPE: Record<keyof typeof VARIANTS, string> = {
    portal: "rounded-full",
    glass: "rounded-full",
    sharp: "",
};
const SHAPE_STYLE: Partial<Record<keyof typeof VARIANTS, React.CSSProperties>> = {
    sharp: { clipPath: "polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)" },
};

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
    variant?: keyof typeof VARIANTS;
    onBack?: () => void;
    backLabel?: string;
    className?: string;
}) {
    const router = useRouter();
    const pill = `inline-flex items-center gap-2 ${SHAPE[variant]} px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.97] transition-all ${VARIANTS[variant]}`;
    const pillStyle = SHAPE_STYLE[variant];

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

    return (
        <div className={`flex items-center justify-between mb-4 ${className}`}>
            <button type="button" onClick={handleBack} className={pill} style={pillStyle}>
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
            </button>
            <Link href="/" className={pill} style={pillStyle}>
                <Home className="w-4 h-4" />
                Home
            </Link>
        </div>
    );
}
