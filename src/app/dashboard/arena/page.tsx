"use client";

import React, { useState } from "react";
import Arena3DViewer from "@/components/arena/Arena3DViewer";
import ArenaSpecsPanel from "@/components/arena/ArenaSpecsPanel";
import {
    ARENA_PARTS,
    OFFICIAL_DOC_DETAILS,
    type ArenaPartInfo,
} from "@/components/arena/arena-constants";
import { Box, ExternalLink } from "lucide-react";

export default function ArenaDashboardPage() {
    const [selectedPart, setSelectedPart] = useState<ArenaPartInfo>(ARENA_PARTS.field);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red/20 text-red border border-red/40">
                            3D FIELD LAB
                        </span>
                        <span className="text-gray-500">·</span>
                        <span className="text-xs text-gray-400">Solo, Indonesia 2027</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                        <Box className="w-7 h-7 text-red" />
                        Arena 3D Model & Rulebook
                    </h1>
                    <p className="mt-1 text-sm text-gray-400 max-w-2xl">
                        Interactive 3D digital twin, CAD-accurate geometry, guided tour, and match simulation of
                        the official ABU Robocon 2027 Game Field: &ldquo;The Pursuit of Mustika Nusantara&rdquo; (Appendix V1.1).
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                        href={OFFICIAL_DOC_DETAILS.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border border-white/20 bg-white/5 text-gray-300 hover:text-white hover:border-red transition"
                    >
                        Official Website
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                </div>
            </div>

            {/* 3D Model Interactive Viewport */}
            <Arena3DViewer
                selectedPart={selectedPart}
                onSelectPart={(part) => setSelectedPart(part)}
            />

            {/* Detailed Rulebook & Dimensional Specifications Panel */}
            <ArenaSpecsPanel
                selectedPart={selectedPart}
                onSelectPart={(part) => setSelectedPart(part)}
            />
        </div>
    );
}
