"use client";

import React, { useState } from "react";
import ArenaBlueprintDiagram from "./ArenaBlueprintDiagram";
import {
    OFFICIAL_DOC_DETAILS,
    type ArenaPartInfo,
} from "./arena-constants";
import {
    Ruler,
    FileText,
    ExternalLink,
    Box,
    Layers,
    Award,
    CheckCircle2,
    Shield,
} from "lucide-react";

interface ArenaSpecsPanelProps {
    selectedPart: ArenaPartInfo;
    onSelectPart: (part: ArenaPartInfo) => void;
}

type TabKey = "blueprint" | "specs" | "objects" | "scoring";

export default function ArenaSpecsPanel({
    selectedPart,
    onSelectPart,
}: ArenaSpecsPanelProps) {
    const [tab, setTab] = useState<TabKey>("blueprint");

    return (
        <div className="w-full bg-black border border-white/15 p-4 sm:p-6 text-white space-y-6">
            {/* Header with Tab Switchers */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-red">
                            ABU Robocon 2027 Field Lab
                        </span>
                        <span className="text-gray-500">·</span>
                        <span className="text-xs text-gray-400">Appendix V1.1 Official Reference</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-white mt-1">
                        Technical Blueprints & Rulebook Detailing
                    </h2>
                </div>

                <div className="flex items-center gap-1 text-xs overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0 sm:flex-wrap">
                    <button
                        onClick={() => setTab("blueprint")}
                        className={`px-2.5 py-1.5 sm:px-3 sm:py-2 border transition whitespace-nowrap flex-shrink-0 ${
                            tab === "blueprint"
                                ? "border-red bg-red/20 text-white font-bold"
                                : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        <Ruler className="w-3.5 h-3.5 inline mr-1" />
                        Blueprints
                    </button>
                    <button
                        onClick={() => setTab("specs")}
                        className={`px-2.5 py-1.5 sm:px-3 sm:py-2 border transition whitespace-nowrap flex-shrink-0 ${
                            tab === "specs"
                                ? "border-red bg-red/20 text-white font-bold"
                                : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5 inline mr-1" />
                        Dimensions
                    </button>
                    <button
                        onClick={() => setTab("objects")}
                        className={`px-2.5 py-1.5 sm:px-3 sm:py-2 border transition whitespace-nowrap flex-shrink-0 ${
                            tab === "objects"
                                ? "border-red bg-red/20 text-white font-bold"
                                : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        <Box className="w-3.5 h-3.5 inline mr-1" />
                        Game Objects
                    </button>
                    <button
                        onClick={() => setTab("scoring")}
                        className={`px-2.5 py-1.5 sm:px-3 sm:py-2 border transition whitespace-nowrap flex-shrink-0 ${
                            tab === "scoring"
                                ? "border-red bg-red/20 text-white font-bold"
                                : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        <Award className="w-3.5 h-3.5 inline mr-1" />
                        Scoring & Rules
                    </button>
                </div>
            </div>

            {/* TAB 1: INTERACTIVE BLUEPRINTS & DIAGRAMS */}
            {tab === "blueprint" && (
                <ArenaBlueprintDiagram
                    selectedZoneId={selectedPart?.id || null}
                    onSelectZone={onSelectPart as any}
                />
            )}

            {/* TAB 2: DIMENSION TABLE */}
            {tab === "specs" && (
                <div className="space-y-4">
                    <p className="text-xs text-gray-400">
                        Official dimensions in millimeters (mm) with standard manufacturing tolerance of ±5% unless noted.
                    </p>

                    <div className="overflow-x-auto border border-white/10">
                        <table className="w-full text-left text-xs border-collapse min-w-[620px]">
                            <thead>
                                <tr className="border-b border-white/20 bg-white/5 text-gray-300 uppercase tracking-wider text-[11px]">
                                    <th className="p-3">Field Element</th>
                                    <th className="p-3">Plan Dimensions (mm)</th>
                                    <th className="p-3">Elevation / Height (mm)</th>
                                    <th className="p-3">Material & Tolerances</th>
                                    <th className="p-3">Rule Reference</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10 text-gray-300 font-mono">
                                <tr>
                                    <td className="p-3 font-semibold text-white">Full Game Field</td>
                                    <td className="p-3">11,000 × 11,000</td>
                                    <td className="p-3">0 (Ground Level)</td>
                                    <td className="p-3">Smooth vinyl / court (±5%)</td>
                                    <td className="p-3">Fig 3.1</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Level 1 (L1) Platform</td>
                                    <td className="p-3">6,000 × 6,000 (Floor: 5,940 × 5,940)</td>
                                    <td className="p-3 text-amber-300 font-bold">+600 from ground</td>
                                    <td className="p-3">Rigid wooden deck (±5%)</td>
                                    <td className="p-3">Fig 3.3, 3.6</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Level 2 (L2) Platform</td>
                                    <td className="p-3">3,000 × 3,000</td>
                                    <td className="p-3 text-amber-300 font-bold">+900 from ground (+300 above L1)</td>
                                    <td className="p-3">Rigid wooden deck (±5%)</td>
                                    <td className="p-3">Fig 3.4, 3.6</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Central Pillar</td>
                                    <td className="p-3">Ø 270 (Cup: Ø 180 × 100 deep)</td>
                                    <td className="p-3 text-amber-300 font-bold">+1,700 apex (+800 above L2)</td>
                                    <td className="p-3">Rigid cylinder with bowl</td>
                                    <td className="p-3">Fig 3.5</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Mustika Pillar</td>
                                    <td className="p-3">Ø 270 (Cup: Ø 180 × 100 deep)</td>
                                    <td className="p-3 text-amber-300 font-bold">+500 from ground</td>
                                    <td className="p-3">Rigid cylinder with bowl</td>
                                    <td className="p-3">Fig 3.5</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Stairs (4 steps)</td>
                                    <td className="p-3">300 L × 1,000 W per step</td>
                                    <td className="p-3">150 H per riser (600 total)</td>
                                    <td className="p-3">Timber assembly (±5%)</td>
                                    <td className="p-3">Fig 3.7, 3.8</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Transfer Area</td>
                                    <td className="p-3">1,000 × 1,000</td>
                                    <td className="p-3">+600 (flush with L1)</td>
                                    <td className="p-3">Landing pad (±5%)</td>
                                    <td className="p-3">Fig 3.3, 3.7</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Ramps</td>
                                    <td className="p-3">3,500 L × 1,000 W</td>
                                    <td className="p-3">Slopes 600 down to 0</td>
                                    <td className="p-3">Incline ramp (±5%)</td>
                                    <td className="p-3">Fig 3.7</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Ground Shared Area</td>
                                    <td className="p-3">1,200 × 1,200 (5×5 cells of 200×200)</td>
                                    <td className="p-3">0 (Ground Level)</td>
                                    <td className="p-3">12 Sky Blocks, center empty</td>
                                    <td className="p-3">Fig 3.2(c)</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Building Spots</td>
                                    <td className="p-3">500 × 500 each</td>
                                    <td className="p-3">+600 on L1, +900 on L2</td>
                                    <td className="p-3">10 spots (6 on L1, 4 on L2)</td>
                                    <td className="p-3">Fig 3.3, 3.4</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Outer Boundary</td>
                                    <td className="p-3">50 thickness</td>
                                    <td className="p-3">100 height</td>
                                    <td className="p-3">Perimeter kerb</td>
                                    <td className="p-3">Fig 3.10(a)</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-semibold text-white">Dividers & L1 Barrier</td>
                                    <td className="p-3">30 thickness</td>
                                    <td className="p-3">50 height</td>
                                    <td className="p-3">Barrier rails with openings</td>
                                    <td className="p-3">Fig 3.10(b-d)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: GAME OBJECTS (APPENDIX PAGE 10) */}
            {tab === "objects" && (
                <div className="space-y-6">
                    <p className="text-xs text-gray-300">
                        Official specifications and manufacturer procurement links from Page 10 of Appendix V1.1.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Earth Block */}
                        <div className="border border-red/40 bg-red/5 p-4 flex flex-col justify-between space-y-4">
                            <div>
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red/20 text-red border border-red/40">
                                    Team Box
                                </span>
                                <h3 className="text-base font-bold text-white mt-2">
                                    Earth Block (Red / Blue)
                                </h3>
                                <div className="mt-3 space-y-1.5 text-xs text-gray-300">
                                    <p>
                                        <strong className="text-white">Dimensions:</strong> 350 × 350 × 350 mm (±5%)
                                    </p>
                                    <p>
                                        <strong className="text-white">Material:</strong> 3-layer corrugated cardboard box
                                    </p>
                                    <p>
                                        <strong className="text-white">Color:</strong> Original color of box: Red or Blue
                                    </p>
                                    <p>
                                        <strong className="text-white">Weight:</strong> Approx. 600 g (±20%)
                                    </p>
                                    <p>
                                        <strong className="text-white">Quantity:</strong> 20 per team
                                    </p>
                                </div>
                            </div>
                            <a
                                href={OFFICIAL_DOC_DETAILS.earthBlockTaobao}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold border border-red text-red hover:bg-red hover:text-white transition"
                            >
                                Taobao Product Link <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>

                        {/* Sky Block */}
                        <div className="border border-blue-500/40 bg-blue-500/5 p-4 flex flex-col justify-between space-y-4">
                            <div>
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/40">
                                    Shared Two-Tone Box
                                </span>
                                <h3 className="text-base font-bold text-white mt-2">
                                    Sky Block (Bi-Color)
                                </h3>
                                <div className="mt-3 space-y-1.5 text-xs text-gray-300">
                                    <p>
                                        <strong className="text-white">Dimensions:</strong> 200 × 200 × 200 mm (±5%)
                                    </p>
                                    <p>
                                        <strong className="text-white">Material:</strong> 3-layer corrugated cardboard box
                                    </p>
                                    <p>
                                        <strong className="text-white">Color:</strong> Red on one half, Blue on the other
                                    </p>
                                    <p>
                                        <strong className="text-white">Weight:</strong> Approx. 220 g (±20%)
                                    </p>
                                    <p>
                                        <strong className="text-white">Quantity:</strong> 12 total (shared by both teams)
                                    </p>
                                </div>
                            </div>
                            <a
                                href={OFFICIAL_DOC_DETAILS.skyBlockTaobao}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold border border-blue-400 text-blue-400 hover:bg-blue-500 hover:text-white transition"
                            >
                                Taobao Product Link <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>

                        {/* Mustika */}
                        <div className="border border-amber-400/40 bg-amber-400/5 p-4 flex flex-col justify-between space-y-4">
                            <div>
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                    Sacred Artifact
                                </span>
                                <h3 className="text-base font-bold text-white mt-2">
                                    Mustika Sphere
                                </h3>
                                <div className="mt-3 space-y-1.5 text-xs text-gray-300">
                                    <p>
                                        <strong className="text-white">Diameter:</strong> Ø ≈ 210 mm
                                    </p>
                                    <p>
                                        <strong className="text-white">Specification:</strong> Mikasa V300W volleyball
                                    </p>
                                    <p>
                                        <strong className="text-white">Circumference:</strong> 65 – 67 cm
                                    </p>
                                    <p>
                                        <strong className="text-white">Weight:</strong> Approx. 270 g
                                    </p>
                                    <p>
                                        <strong className="text-white">Goal:</strong> Central Pillar top cup (+250 pts)
                                    </p>
                                </div>
                            </div>
                            <div className="p-2 border border-amber-400/20 bg-amber-400/10 text-[11px] text-amber-200">
                                Theme: &ldquo;The Pursuit of Mustika Nusantara&rdquo;. Satisfy the Sanctuary Mandate (2 Complete Towers) to unlock.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: SCORING & RULES */}
            {tab === "scoring" && (
                <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-white/10 p-4 space-y-3 bg-black">
                            <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                <Award className="w-4 h-4 text-red" /> Official Scoring Table
                            </h4>
                            <ul className="space-y-2">
                                <li className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Block delivered to Transfer Area</span>
                                    <strong className="text-white">+5 pts each</strong>
                                </li>
                                <li className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Layer 1 Earth Block on Level 1</span>
                                    <strong className="text-white">+10 pts</strong>
                                </li>
                                <li className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Layer 2 Earth Block on Level 1</span>
                                    <strong className="text-white">+20 pts</strong>
                                </li>
                                <li className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Complete Tower capped with Sky Block on Level 1</span>
                                    <strong className="text-amber-300 font-bold">+40 pts</strong>
                                </li>
                                <li className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Layer 1 Earth Block on Level 2</span>
                                    <strong className="text-white">+20 pts</strong>
                                </li>
                                <li className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Layer 2 Earth Block on Level 2</span>
                                    <strong className="text-white">+40 pts</strong>
                                </li>
                                <li className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Complete Tower capped with Sky Block on Level 2</span>
                                    <strong className="text-amber-300 font-bold">+80 pts</strong>
                                </li>
                                <li className="flex justify-between border-b border-white/10 pb-1">
                                    <span>Enshrining Mustika in Central Pillar cup</span>
                                    <strong className="text-amber-300 text-sm font-black">+250 pts</strong>
                                </li>
                            </ul>
                        </div>

                        <div className="border border-white/10 p-4 space-y-3 bg-black">
                            <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                <Shield className="w-4 h-4 text-red" /> The Sanctuary Mandate
                            </h4>
                            <p>
                                • A team achieves the <strong>Sanctuary Mandate</strong> when they have built at least two Complete Towers, with at least one situated on an L1 or L2 Shared Building Spot.
                            </p>
                            <p>
                                • Only after achieving the Sanctuary Mandate is the Transporter Robot (TR) permitted to lift and retrieve the Mustika from the Mustika Pillar.
                            </p>
                            <p>
                                • In Rulebook V1.1, the Transporter Robot (TR) cannot place a block onto the Transfer Area while touching the Ground Area, meaning TR must climb the ramp to complete delivery.
                            </p>
                            <p>
                                • Match duration is 3 minutes (180 seconds). Even after the Mustika is enshrined, towers continue to score until the buzzer!
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
