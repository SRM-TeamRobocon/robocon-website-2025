"use client";

import React, { useState } from "react";
import { ARENA_PARTS, type ArenaPartInfo } from "./arena-constants";
import { Ruler, Layers, Eye } from "lucide-react";

interface ArenaBlueprintDiagramProps {
    selectedZoneId: string | null;
    onSelectZone: (zone: ArenaPartInfo) => void;
}

type DiagramMode = "plan" | "side" | "stairs" | "pillars";

export default function ArenaBlueprintDiagram({
    selectedZoneId,
    onSelectZone,
}: ArenaBlueprintDiagramProps) {
    const [mode, setMode] = useState<DiagramMode>("plan");

    const selectById = (id: string) => {
        const zone = ARENA_PARTS[id];
        if (zone) onSelectZone(zone);
    };

    return (
        <div className="w-full bg-black border border-white/15 p-4 sm:p-5 text-white space-y-4">
            {/* Header & Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-red" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                        Official Technical Blueprint & Dimensions (Appendix Drawings)
                    </h3>
                </div>

                <div className="flex flex-wrap items-center gap-1 text-xs">
                    <button
                        onClick={() => setMode("plan")}
                        className={`px-2.5 py-1 border transition ${
                            mode === "plan"
                                ? "border-red bg-red/20 text-white font-bold"
                                : "border-white/10 text-gray-400 hover:text-white"
                        }`}
                    >
                        Figure 3.1: Plan View (11m)
                    </button>
                    <button
                        onClick={() => setMode("side")}
                        className={`px-2.5 py-1 border transition ${
                            mode === "side"
                                ? "border-red bg-red/20 text-white font-bold"
                                : "border-white/10 text-gray-400 hover:text-white"
                        }`}
                    >
                        Figure 3.6: Elevation Profile
                    </button>
                    <button
                        onClick={() => setMode("stairs")}
                        className={`px-2.5 py-1 border transition ${
                            mode === "stairs"
                                ? "border-red bg-red/20 text-white font-bold"
                                : "border-white/10 text-gray-400 hover:text-white"
                        }`}
                    >
                        Figure 3.7 & 3.8: Stairs & Ramp
                    </button>
                    <button
                        onClick={() => setMode("pillars")}
                        className={`px-2.5 py-1 border transition ${
                            mode === "pillars"
                                ? "border-red bg-red/20 text-white font-bold"
                                : "border-white/10 text-gray-400 hover:text-white"
                        }`}
                    >
                        Figure 3.5: Pillar Receptacles
                    </button>
                </div>
            </div>

            {/* DIAGRAM VIEW 1: PLAN VIEW (FIGURE 3.1) */}
            {mode === "plan" && (
                <div className="relative w-full aspect-square max-w-[650px] mx-auto bg-[#0d1117] border border-white/15 p-2 overflow-hidden">
                    <svg viewBox="0 0 1100 1100" className="w-full h-full select-none font-mono">
                        {/* Red Team Half (Left) */}
                        <rect
                            x="50"
                            y="50"
                            width="500"
                            height="1000"
                            fill="#2a1414"
                            stroke="#552222"
                            strokeWidth="2"
                            className="cursor-pointer hover:opacity-90"
                            onClick={() => selectById("ground")}
                        />
                        {/* Blue Team Half (Right) */}
                        <rect
                            x="550"
                            y="50"
                            width="500"
                            height="1000"
                            fill="#141f2e"
                            stroke="#223b55"
                            strokeWidth="2"
                            className="cursor-pointer hover:opacity-90"
                            onClick={() => selectById("ground")}
                        />

                        {/* Outer Boundary Dimensions */}
                        <line x1="50" y1="25" x2="1050" y2="25" stroke="#888" strokeWidth="1.5" />
                        <line x1="50" y1="18" x2="50" y2="32" stroke="#888" strokeWidth="1.5" />
                        <line x1="1050" y1="18" x2="1050" y2="32" stroke="#888" strokeWidth="1.5" />
                        <text x="550" y="20" fill="#fff" fontSize="18" textAnchor="middle" fontWeight="bold">
                            11000 mm (Game Field)
                        </text>

                        {/* Center Line */}
                        <line x1="550" y1="50" x2="550" y2="1050" stroke="#fff" strokeWidth="3" strokeDasharray="8 6" />

                        {/* Top Labels */}
                        <text x="300" y="80" fill="#ef4444" fontSize="20" fontWeight="bold" textAnchor="middle">
                            RED TEAM AREA
                        </text>
                        <text x="800" y="80" fill="#3b82f6" fontSize="20" fontWeight="bold" textAnchor="middle">
                            BLUE TEAM AREA
                        </text>

                        {/* Red Storage */}
                        <rect
                            x="50"
                            y="50"
                            width="200"
                            height="100"
                            fill="#b91c1c"
                            stroke="#ef4444"
                            strokeWidth="2"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("storage")}
                        />
                        <text x="150" y="105" fill="#fff" fontSize="14" fontWeight="bold" textAnchor="middle">
                            Storage Area (Red)
                        </text>
                        <text x="150" y="125" fill="#fca5a5" fontSize="11" textAnchor="middle">
                            2000 × 1000 mm
                        </text>

                        {/* Blue Storage */}
                        <rect
                            x="850"
                            y="50"
                            width="200"
                            height="100"
                            fill="#1d4ed8"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("storage")}
                        />
                        <text x="950" y="105" fill="#fff" fontSize="14" fontWeight="bold" textAnchor="middle">
                            Storage Area (Blue)
                        </text>
                        <text x="950" y="125" fill="#93c5fd" fontSize="11" textAnchor="middle">
                            2000 × 1000 mm
                        </text>

                        {/* Mustika Pillar (Top Center) */}
                        <rect
                            x="500"
                            y="75"
                            width="100"
                            height="100"
                            fill="#523916"
                            stroke="#d97706"
                            strokeWidth="2"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("mpillar")}
                        />
                        <circle cx="550" cy="125" r="14" fill="#d97706" stroke="#b45309" strokeWidth="2" />
                        <circle cx="550" cy="125" r="10" fill="#facc15" />
                        <text x="550" y="65" fill="#facc15" fontSize="12" fontWeight="bold" textAnchor="middle">
                            Mustika Pillar (H: 500 mm)
                        </text>

                        {/* Level 1 Platform (6000x6000 mm -> 600x600 px) */}
                        <rect
                            x="250"
                            y="250"
                            width="600"
                            height="600"
                            fill="#1e222b"
                            stroke="#4b5563"
                            strokeWidth="3"
                            className="cursor-pointer hover:brightness-110"
                            onClick={() => selectById("level1")}
                        />

                        {/* Stairs, Transfer & Ramp on Left */}
                        <rect
                            x="200"
                            y="700"
                            width="50"
                            height="120"
                            fill="#854d0e"
                            stroke="#ca8a04"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("access")}
                        />
                        <text x="175" y="760" fill="#ca8a04" fontSize="11" textAnchor="middle" transform="rotate(-90 175 760)">
                            Stairs (4 Steps)
                        </text>

                        <rect
                            x="200"
                            y="600"
                            width="50"
                            height="100"
                            fill="#ca8a04"
                            stroke="#eab308"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("transfer")}
                        />
                        <text x="225" y="655" fill="#000" fontSize="10" fontWeight="bold" textAnchor="middle">
                            Transfer
                        </text>

                        <rect
                            x="200"
                            y="250"
                            width="50"
                            height="350"
                            fill="#78350f"
                            stroke="#b45309"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("access")}
                        />
                        <text x="175" y="425" fill="#f59e0b" fontSize="12" fontWeight="bold" textAnchor="middle" transform="rotate(-90 175 425)">
                            Ramp (3500 mm)
                        </text>

                        {/* Stairs, Transfer & Ramp on Right */}
                        <rect
                            x="850"
                            y="700"
                            width="50"
                            height="120"
                            fill="#854d0e"
                            stroke="#ca8a04"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("access")}
                        />
                        <rect
                            x="850"
                            y="600"
                            width="50"
                            height="100"
                            fill="#ca8a04"
                            stroke="#eab308"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("transfer")}
                        />
                        <text x="875" y="655" fill="#000" fontSize="10" fontWeight="bold" textAnchor="middle">
                            Transfer
                        </text>
                        <rect
                            x="850"
                            y="250"
                            width="50"
                            height="350"
                            fill="#78350f"
                            stroke="#b45309"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("access")}
                        />

                        {/* Level 2 Platform */}
                        <rect
                            x="400"
                            y="400"
                            width="300"
                            height="300"
                            fill="#374151"
                            stroke="#9ca3af"
                            strokeWidth="3"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("level2")}
                        />
                        <text x="550" y="430" fill="#e5e7eb" fontSize="16" fontWeight="bold" textAnchor="middle">
                            Level 2 Platform (+900 mm)
                        </text>

                        {/* Central Pillar */}
                        <circle
                            cx="550"
                            cy="550"
                            r="18"
                            fill="#b45309"
                            stroke="#f59e0b"
                            strokeWidth="2.5"
                            className="cursor-pointer hover:scale-125 transition-transform"
                            onClick={() => selectById("cpillar")}
                        />
                        <circle cx="550" cy="550" r="10" fill="#1f2937" stroke="#f59e0b" strokeWidth="1" />
                        <text x="550" y="585" fill="#f59e0b" fontSize="13" fontWeight="bold" textAnchor="middle">
                            Central Pillar (1700 mm) · Empty Bowl
                        </text>

                        {/* Ground Shared Area (12 Sky Blocks) */}
                        <rect
                            x="490"
                            y="880"
                            width="120"
                            height="120"
                            fill="#42392d"
                            stroke="#eab308"
                            strokeWidth="2"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("skyarea")}
                        />
                        <text x="550" y="870" fill="#facc15" fontSize="11" fontWeight="bold" textAnchor="middle">
                            12 Sky Blocks (6 Red, 6 Blue)
                        </text>

                        {/* Start Zones */}
                        <rect
                            x="55"
                            y="975"
                            width="40"
                            height="70"
                            fill="#dc2626"
                            stroke="#f87171"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("startzone")}
                        />
                        <rect
                            x="105"
                            y="975"
                            width="40"
                            height="70"
                            fill="#dc2626"
                            stroke="#f87171"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("startzone")}
                        />

                        <rect
                            x="955"
                            y="975"
                            width="40"
                            height="70"
                            fill="#2563eb"
                            stroke="#60a5fa"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("startzone")}
                        />
                        <rect
                            x="1005"
                            y="975"
                            width="40"
                            height="70"
                            fill="#2563eb"
                            stroke="#60a5fa"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:brightness-125"
                            onClick={() => selectById("startzone")}
                        />
                    </svg>
                </div>
            )}

            {/* DIAGRAM VIEW 2: SIDE ELEVATION PROFILE */}
            {mode === "side" && (
                <div className="relative w-full aspect-[2/1] max-w-[700px] mx-auto bg-[#0d1117] border border-white/15 p-3 overflow-hidden">
                    <svg viewBox="0 0 1100 550" className="w-full h-full select-none font-mono">
                        <line x1="50" y1="450" x2="1050" y2="450" stroke="#777" strokeWidth="3" />
                        <text x="80" y="475" fill="#999" fontSize="14">
                            Ground Level (0 mm)
                        </text>

                        {/* Mustika Pillar on Right */}
                        <rect x="900" y="400" width="30" height="50" fill="#b45309" stroke="#f59e0b" strokeWidth="1.5" />
                        <circle cx="915" cy="388" r="12" fill="#facc15" />
                        <text x="915" y="365" fill="#facc15" fontSize="12" fontWeight="bold" textAnchor="middle">
                            Mustika Pillar (+500 mm)
                        </text>
                        <line x1="945" y1="400" x2="945" y2="450" stroke="#888" strokeWidth="1.5" />
                        <text x="980" y="430" fill="#fff" fontSize="12">
                            500
                        </text>

                        {/* Level 1 Platform */}
                        <rect x="250" y="390" width="600" height="60" fill="#1f2937" stroke="#4b5563" strokeWidth="2" />
                        <text x="320" y="425" fill="#e5e7eb" fontSize="14" fontWeight="bold">
                            Level 1 (+600 mm)
                        </text>
                        <line x1="220" y1="390" x2="220" y2="450" stroke="#888" strokeWidth="1.5" />
                        <text x="180" y="425" fill="#fff" fontSize="14" fontWeight="bold">
                            600 mm
                        </text>

                        {/* Level 2 Platform */}
                        <rect x="400" y="360" width="300" height="30" fill="#374151" stroke="#9ca3af" strokeWidth="2" />
                        <text x="550" y="380" fill="#f3f4f6" fontSize="13" fontWeight="bold" textAnchor="middle">
                            Level 2 (+900 mm)
                        </text>
                        <line x1="380" y1="360" x2="380" y2="390" stroke="#888" strokeWidth="1.5" />
                        <text x="345" y="380" fill="#fff" fontSize="12">
                            300
                        </text>

                        {/* Central Pillar */}
                        <rect x="535" y="280" width="30" height="80" fill="#b45309" stroke="#f59e0b" strokeWidth="2" />
                        <ellipse cx="550" cy="280" rx="15" ry="6" fill="#1f2937" stroke="#f59e0b" strokeWidth="1.5" />
                        <text x="550" y="250" fill="#f59e0b" fontSize="13" fontWeight="bold" textAnchor="middle">
                            Central Pillar (+1700 mm) · Receptacle Bowl
                        </text>
                        <line x1="580" y1="280" x2="580" y2="360" stroke="#888" strokeWidth="1.5" />
                        <text x="615" y="325" fill="#fff" fontSize="13">
                            800 mm
                        </text>
                    </svg>
                </div>
            )}

            {/* DIAGRAM VIEW 3: STAIRS & RAMP */}
            {mode === "stairs" && (
                <div className="relative w-full aspect-[2/1] max-w-[700px] mx-auto bg-[#0d1117] border border-white/15 p-3 overflow-hidden">
                    <svg viewBox="0 0 900 450" className="w-full h-full select-none font-mono">
                        <line x1="50" y1="380" x2="850" y2="380" stroke="#888" strokeWidth="3" />
                        <rect x="80" y="200" width="740" height="180" fill="#1f2937" opacity="0.3" stroke="#4b5563" strokeDasharray="4 4" />

                        {/* Stairs */}
                        <path d="M 80 380 L 140 380 L 140 335 L 80 335 Z" fill="#854d0e" stroke="#ca8a04" strokeWidth="2" />
                        <path d="M 140 380 L 200 380 L 200 290 L 140 290 L 140 335 Z" fill="#854d0e" stroke="#ca8a04" strokeWidth="2" />
                        <path d="M 200 380 L 260 380 L 260 245 L 200 245 L 200 290 Z" fill="#854d0e" stroke="#ca8a04" strokeWidth="2" />
                        <path d="M 260 380 L 320 380 L 320 200 L 260 200 L 260 245 Z" fill="#854d0e" stroke="#ca8a04" strokeWidth="2" />

                        {/* Transfer Area */}
                        <rect x="320" y="200" width="120" height="180" fill="#ca8a04" stroke="#eab308" strokeWidth="2" />
                        <text x="380" y="290" fill="#000" fontSize="13" fontWeight="bold" textAnchor="middle">
                            Transfer Area
                        </text>
                        <text x="380" y="310" fill="#1f1a14" fontSize="11" textAnchor="middle">
                            1000 × 1000 mm
                        </text>

                        {/* Ramp */}
                        <polygon points="440,200 440,380 800,380" fill="#78350f" stroke="#b45309" strokeWidth="2" />
                        <text x="600" y="330" fill="#f59e0b" fontSize="14" fontWeight="bold">
                            Ramp (3500 mm slope)
                        </text>

                        <line x1="825" y1="200" x2="825" y2="380" stroke="#fff" strokeWidth="1.5" />
                        <text x="835" y="295" fill="#fff" fontSize="14" fontWeight="bold">
                            600 mm
                        </text>
                        <text x="170" y="170" fill="#fff" fontSize="13" fontWeight="bold">
                            4 Steps: 300 mm (L) × 1000 mm (W) × 150 mm (H)
                        </text>
                    </svg>
                </div>
            )}

            {/* DIAGRAM VIEW 4: PILLARS & RECEPTACLES */}
            {mode === "pillars" && (
                <div className="relative w-full aspect-[2/1] max-w-[700px] mx-auto bg-[#0d1117] border border-white/15 p-3 overflow-hidden">
                    <svg viewBox="0 0 900 450" className="w-full h-full select-none font-mono">
                        <line x1="50" y1="380" x2="850" y2="380" stroke="#888" strokeWidth="3" />

                        {/* Mustika Pillar */}
                        <text x="250" y="100" fill="#facc15" fontSize="16" fontWeight="bold" textAnchor="middle">
                            Mustika Pillar (Ground)
                        </text>
                        <rect x="200" y="230" width="100" height="150" fill="#92400e" stroke="#f59e0b" strokeWidth="2" />
                        <rect x="220" y="230" width="60" height="40" fill="#1e1b18" stroke="#facc15" strokeWidth="1.5" />
                        <circle cx="250" cy="225" r="35" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
                        <text x="250" y="230" fill="#000" fontSize="11" fontWeight="bold" textAnchor="middle">
                            Ø 210 mm
                        </text>
                        <line x1="315" y1="230" x2="315" y2="380" stroke="#fff" strokeWidth="1.5" />
                        <text x="325" y="310" fill="#fff" fontSize="13" fontWeight="bold">
                            500 mm
                        </text>

                        {/* Central Pillar */}
                        <text x="650" y="50" fill="#facc15" fontSize="16" fontWeight="bold" textAnchor="middle">
                            Central Pillar (Level 2)
                        </text>
                        <rect x="530" y="260" width="240" height="120" fill="#374151" stroke="#9ca3af" strokeWidth="2" />
                        <text x="650" y="330" fill="#e5e7eb" fontSize="13" textAnchor="middle">
                            Level 2 (+900 mm)
                        </text>
                        <rect x="600" y="110" width="100" height="150" fill="#92400e" stroke="#f59e0b" strokeWidth="2" />
                        <rect x="620" y="110" width="60" height="40" fill="#1e1b18" stroke="#facc15" strokeWidth="1.5" />
                        <circle cx="650" cy="105" r="35" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
                        <text x="650" y="110" fill="#000" fontSize="11" fontWeight="bold" textAnchor="middle">
                            Ø 210 mm
                        </text>
                        <line x1="715" y1="110" x2="715" y2="260" stroke="#fff" strokeWidth="1.5" />
                        <text x="725" y="190" fill="#fff" fontSize="13" fontWeight="bold">
                            800 mm
                        </text>
                        <line x1="790" y1="110" x2="790" y2="380" stroke="#facc15" strokeWidth="1.5" />
                        <text x="800" y="250" fill="#facc15" fontSize="13" fontWeight="bold">
                            1700 mm Total
                        </text>
                    </svg>
                </div>
            )}
        </div>
    );
}
