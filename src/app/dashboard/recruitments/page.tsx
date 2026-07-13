"use client";

import { Sparkles } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

export default function RecruitmentsPage() {
    const ready = useRequireRole(["lead", "admin"]);

    if (!ready) return null;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Recruitments</h1>
                <p className="mt-2 text-gray-400 max-w-xl text-sm">Applications, orientation, exam, and interview tracking for new recruits.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red/15 text-red mb-4">
                    <Sparkles className="w-6 h-6" />
                </span>
                <h2 className="text-2xl font-bold text-white mb-2">Coming Soon</h2>
                <p className="text-gray-400 text-sm max-w-sm mx-auto">
                    The recruitment pipeline for this tenure is being built. Check back soon.
                </p>
            </div>
        </div>
    );
}
