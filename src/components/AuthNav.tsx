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
} as const;

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
    const pill = `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.97] transition-all ${VARIANTS[variant]}`;

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
