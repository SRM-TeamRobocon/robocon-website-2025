"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import {
    createArenaEngine,
    type EngineInstance,
} from "./three-arena-engine";
import {
    ARENA_PARTS,
    TOUR_STEPS,
    type ArenaPartInfo,
} from "./arena-constants";
import {
    Compass,
    RotateCw,
    Layers,
    Eye,
    Maximize2,
    Minimize2,
    Camera,
    Play,
    Pause,
    SkipBack,
    ChevronLeft,
    ChevronRight,
    Bot,
    Box,
    Flag,
    CheckCircle2,
    X,
    Volume2,
    VolumeX,
    RotateCcw,
    Radio,
} from "lucide-react";

interface Arena3DViewerProps {
    selectedPart: ArenaPartInfo;
    onSelectPart: (part: ArenaPartInfo) => void;
}

type MainMode = "tour" | "free" | "match";

export default function Arena3DViewer({
    selectedPart,
    onSelectPart,
}: Arena3DViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<EngineInstance | null>(null);
    const lastSelectedIdRef = useRef<string | null>(null);

    const [threeLoaded, setThreeLoaded] = useState(false);
    const [mode, setMode] = useState<MainMode>("tour");

    // Tour state
    const [tourStep, setTourStep] = useState(0);

    // View & Layer states
    const [wireframe, setWireframe] = useState(false);
    const [isolate, setIsolate] = useState(false);
    const [showRobots, setShowRobots] = useState(true);
    const [autoRotate, setAutoRotate] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Match simulator state
    const [isPlaying, setIsPlaying] = useState(false);
    const [simTime, setSimTime] = useState(0); // 0 to 180 seconds
    const [simSpeed, setSimSpeed] = useState(1);
    const [redScore, setRedScore] = useState(0);
    const [blueScore, setBlueScore] = useState(0);
    const [matchLog, setMatchLog] = useState<string[]>([
        "0:00 - Match initiated. Transporter Robots in starting zones.",
    ]);

    // Narration Audio state (ElevenLabs energetic audio track)
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [audioVolume, setAudioVolume] = useState(0.85);
    const [audioStatus, setAudioStatus] = useState("Captions on · voice off");
    const [currentAudioSrc, setCurrentAudioSrc] = useState<string | null>(null);

    const TOUR_AUDIO_MAP: Record<string, string> = {
        field: "/audio/narration/tour-field.mp3",
        ground: "/audio/narration/tour-ground.mp3",
        startzone: "/audio/narration/tour-startzone.mp3",
        storage: "/audio/narration/tour-storage.mp3",
        earthblock: "/audio/narration/tour-earthblock.mp3",
        skyarea: "/audio/narration/tour-skyarea.mp3",
        skyblock: "/audio/narration/tour-skyblock.mp3",
        mpillar: "/audio/narration/tour-mpillar.mp3",
        mustika: "/audio/narration/tour-mustika.mp3",
        access: "/audio/narration/tour-access.mp3",
        transfer: "/audio/narration/tour-transfer.mp3",
        buildspot: "/audio/narration/tour-buildspot.mp3",
        tower: "/audio/narration/tour-tower.mp3",
        level1: "/audio/narration/tour-level2.mp3",
        level2: "/audio/narration/tour-level2.mp3",
        cpillar: "/audio/narration/tour-cpillar.mp3",
    };

    const playAudioFile = useCallback((src: string, force = false) => {
        if (typeof window === "undefined") return;
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.onended = () => {
                setAudioStatus("Ready · voice line completed");
            };
            audioRef.current.onerror = () => {
                setAudioStatus("Caption only · audio file unavailable");
            };
        }
        const audio = audioRef.current;
        audio.volume = audioVolume;
        setCurrentAudioSrc(src);

        if (!audioEnabled && !force) {
            setAudioStatus("Captions on · voice off");
            return;
        }

        audio.pause();
        audio.currentTime = 0;
        audio.src = src;
        setAudioStatus("Loading voice line...");

        const attempt = audio.play();
        if (attempt) {
            attempt
                .then(() => {
                    const tag = src.split("/").pop()?.replace(".mp3", "") || "voice";
                    setAudioStatus(`Speaking · ${tag}`);
                })
                .catch(() => {
                    setAudioStatus("Caption only · audio autoplay restricted");
                });
        }
    }, [audioEnabled, audioVolume]);

    const replayCurrentAudio = () => {
        if (currentAudioSrc) {
            playAudioFile(currentAudioSrc, true);
        }
    };

    // Check if THREE is already in window
    useEffect(() => {
        if (typeof window !== "undefined" && (window as any).THREE) {
            setThreeLoaded(true);
        }
    }, []);

    // Initialize 3D engine once THREE is loaded
    useEffect(() => {
        if (!threeLoaded) return;
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const engine = createArenaEngine(container, canvas, (part) => {
            onSelectPart(part);
        });

        if (!engine) return;
        engineRef.current = engine;

        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    engine.resize(width, height);
                }
            }
        });
        ro.observe(container);

        return () => {
            ro.disconnect();
            engine.destroy();
            engineRef.current = null;
        };
    }, [threeLoaded, onSelectPart]);

    // React to selectedPart changes
    useEffect(() => {
        if (!engineRef.current || !selectedPart) return;
        if (lastSelectedIdRef.current === selectedPart.id) return;
        lastSelectedIdRef.current = selectedPart.id;
        engineRef.current.selectPart(selectedPart.id);
    }, [selectedPart]);

    // Handle Tour Step changes
    const goToTourStep = useCallback(
        (stepIndex: number) => {
            const step = TOUR_STEPS[stepIndex];
            if (!step) return;
            setTourStep(stepIndex);

            const part = ARENA_PARTS[step.key];
            if (part) {
                lastSelectedIdRef.current = step.key;
                onSelectPart(part);
                if (engineRef.current) {
                    engineRef.current.selectPart(step.key);
                    if (step.key === "tower") {
                        engineRef.current.demoAssembleTower();
                    } else {
                        engineRef.current.resetDemoTower();
                    }
                }
                const audioUrl = TOUR_AUDIO_MAP[step.key];
                if (audioUrl) {
                    playAudioFile(audioUrl);
                }
            }
        },
        [onSelectPart, playAudioFile]
    );

    // Handle Match Simulator tick with smooth 50ms continuous movement
    useEffect(() => {
        if (!isPlaying) return;

        const intervalMs = 50;
        const interval = setInterval(() => {
            setSimTime((prev) => {
                const dt = (intervalMs / 1000) * simSpeed;
                const next = Math.min(180, prev + dt);

                if (engineRef.current) {
                    try {
                        engineRef.current.updateMatchSimTime(next);
                    } catch (e) {
                        console.error("Match Sim tick error:", e);
                    }
                }

                if (next >= 180) {
                    setIsPlaying(false);
                }

                // Simulated scoring milestones with audio voiceover and synchronized game state
                if (prev < 1 && next >= 1) {
                    playAudioFile("/audio/narration/match-phase-start.mp3");
                } else if (prev < 30 && next >= 30) {
                    setRedScore((s) => s + 5);
                    setBlueScore((s) => s + 5);
                    setMatchLog((l) => [
                        "0:30 - Both teams deliver Earth Blocks to Transfer Area (+5 pts each).",
                        ...l,
                    ]);
                    playAudioFile("/audio/narration/match-phase-harvest.mp3");
                } else if (prev < 65 && next >= 65) {
                    setRedScore((s) => s + 20);
                    setMatchLog((l) => [
                        "1:05 - Red Builder Robot places two Earth Blocks on L1 Building Spot.",
                        ...l,
                    ]);
                    playAudioFile("/audio/narration/match-score-red-tower-a.mp3");
                } else if (prev < 90 && next >= 90) {
                    setRedScore((s) => s + 40);
                    setBlueScore((s) => s + 20);
                    setMatchLog((l) => [
                        "1:30 - Red caps Complete Tower with Sky Block (+40 pts)!",
                        "1:30 - Blue erects two-tier Earth tower on L1 (+20 pts).",
                        ...l,
                    ]);
                    playAudioFile("/audio/narration/match-phase-first-caps.mp3");
                } else if (prev < 135 && next >= 135) {
                    setRedScore((s) => s + 250);
                    setMatchLog((l) => [
                        "2:15 - RED ENSHRINES THE MUSTIKA ON CENTRAL PILLAR (+250 PTS)!",
                        ...l,
                    ]);
                    playAudioFile("/audio/narration/match-score-mustika.mp3");
                } else if (prev < 165 && next >= 165) {
                    playAudioFile("/audio/narration/match-phase-final-push.mp3");
                }

                return next;
            });
        }, intervalMs);

        return () => clearInterval(interval);
    }, [isPlaying, simSpeed, playAudioFile]);

    const resetMatch = () => {
        setIsPlaying(false);
        setSimTime(0);
        setRedScore(0);
        setBlueScore(0);
        setMatchLog(["0:00 - Match reset. Ready for 3-minute simulation."]);
        if (engineRef.current) {
            engineRef.current.updateMatchSimTime(0);
        }
    };

    // Camera preset buttons
    const handlePreset = (view: "iso" | "top" | "side" | "red" | "blue" | "summit") => {
        if (engineRef.current) {
            engineRef.current.setPresetView(view);
        }
    };

    // Fullscreen toggle
    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    // Screenshot helper
    const handleScreenshot = () => {
        if (!engineRef.current) return;
        const dataUrl = engineRef.current.takeScreenshot();
        if (!dataUrl) return;
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `robocon-2027-arena-${Date.now()}.png`;
        a.click();
    };

    const formatClock = (seconds: number) => {
        const remaining = Math.max(0, 180 - seconds);
        const m = Math.floor(remaining / 60);
        const s = Math.floor(remaining % 60);
        return `${m}:${String(s).padStart(2, "0")}`;
    };

    return (
        <div className="w-full space-y-4">
            {/* Load Three.js r128 script if needed */}
            {!threeLoaded && (
                <Script
                    src="/vendor/three.r128.min.js"
                    strategy="afterInteractive"
                    onLoad={() => setThreeLoaded(true)}
                />
            )}

            {/* Top Mode Switcher Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border border-white/10 bg-black p-2 sm:p-2.5">
                <div className="grid grid-cols-1 xs:grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                        onClick={() => {
                            setMode("tour");
                            if (engineRef.current) engineRef.current.setMatchSimStage("reset");
                            goToTourStep(0);
                        }}
                        className={`px-2.5 py-1.5 text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                            mode === "tour"
                                ? "border-red bg-red text-white"
                                : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        <Compass className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">Guided Tour ({TOUR_STEPS.length})</span>
                    </button>
                    <button
                        onClick={() => {
                            setMode("free");
                            if (engineRef.current) {
                                engineRef.current.resetDemoTower();
                                engineRef.current.setMatchSimStage("reset");
                            }
                        }}
                        className={`px-2.5 py-1.5 text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                            mode === "free"
                                ? "border-red bg-red text-white"
                                : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        <Box className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">Free Orbit</span>
                    </button>
                    <button
                        onClick={() => {
                            setMode("match");
                            if (engineRef.current) {
                                engineRef.current.resetDemoTower();
                                engineRef.current.updateMatchSimTime(simTime);
                            }
                        }}
                        className={`px-2.5 py-1.5 text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                            mode === "match"
                                ? "border-red bg-red text-white"
                                : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        <Flag className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">3-Min Match Sim</span>
                    </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-1 text-xs">
                    <span className="text-[10px] text-gray-400 uppercase font-mono tracking-wider">
                        Three.js Digital Twin · Appendix V1.1
                    </span>
                </div>
            </div>

            {/* Audio Voice Narration Control Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border border-white/10 bg-black/90 p-2 sm:p-2.5 text-xs text-white">
                <div className="flex items-center justify-between sm:justify-start gap-2">
                    <button
                        onClick={() => {
                            const next = !audioEnabled;
                            setAudioEnabled(next);
                            if (next) {
                                if (currentAudioSrc) playAudioFile(currentAudioSrc, true);
                                else if (TOUR_STEPS[tourStep]) {
                                    const src = TOUR_AUDIO_MAP[TOUR_STEPS[tourStep].key];
                                    if (src) playAudioFile(src, true);
                                }
                            } else {
                                if (audioRef.current) audioRef.current.pause();
                                setAudioStatus("Captions on · voice off");
                            }
                        }}
                        className={`px-2.5 py-1.5 border font-bold flex items-center gap-1.5 transition text-xs ${
                            audioEnabled
                                ? "border-amber-400 bg-amber-400/20 text-amber-300"
                                : "border-white/15 bg-white/5 text-gray-400 hover:text-white"
                        }`}
                    >
                        {audioEnabled ? <Volume2 className="w-3.5 h-3.5 flex-shrink-0" /> : <VolumeX className="w-3.5 h-3.5 flex-shrink-0" />}
                        <span>{audioEnabled ? "Voice: ON" : "Voice: OFF"}</span>
                    </button>

                    <button
                        disabled={!currentAudioSrc}
                        onClick={replayCurrentAudio}
                        title="Replay Voice Line"
                        className="px-2 py-1.5 border border-white/15 bg-white/5 text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition text-xs"
                    >
                        <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
                        Replay
                    </button>

                    <div className="flex items-center gap-1.5 pl-1">
                        <span className="text-[9px] text-gray-400 uppercase font-mono">Vol</span>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={audioVolume}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                setAudioVolume(v);
                                if (audioRef.current) audioRef.current.volume = v;
                            }}
                            className="w-14 sm:w-20 accent-red cursor-pointer"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-hidden">
                    <Radio className={`w-3 h-3 flex-shrink-0 ${audioEnabled ? "text-amber-400 animate-pulse" : "text-gray-500"}`} />
                    <span className="text-[10px] sm:text-[11px] font-mono text-gray-300 truncate">
                        {audioStatus}
                    </span>
                </div>
            </div>

            {/* Main 3D Viewport Box */}
            <div
                ref={containerRef}
                className="relative w-full h-[380px] xs:h-[440px] sm:h-[520px] lg:h-[620px] bg-black border border-white/15 overflow-hidden select-none flex flex-col touch-none"
            >
                {/* Canvas element */}
                <canvas
                    ref={canvasRef}
                    className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
                    style={{ touchAction: "none" }}
                />

                {/* Top Viewport Toolbar */}
                <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 pointer-events-none">
                    {/* Camera Presets */}
                    <div className="flex items-center gap-1 pointer-events-auto bg-black/90 backdrop-blur-md p-1 border border-white/15 text-xs max-w-full overflow-x-auto no-scrollbar">
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1.5 py-0.5 flex-shrink-0">
                            Views:
                        </span>
                        <button
                            onClick={() => handlePreset("iso")}
                            className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-gray-300 hover:text-white hover:bg-white/10 transition border border-white/10 whitespace-nowrap flex-shrink-0"
                        >
                            Isometric
                        </button>
                        <button
                            onClick={() => handlePreset("top")}
                            className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-gray-300 hover:text-white hover:bg-white/10 transition border border-white/10 whitespace-nowrap flex-shrink-0"
                        >
                            Top
                        </button>
                        <button
                            onClick={() => handlePreset("side")}
                            className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-gray-300 hover:text-white hover:bg-white/10 transition border border-white/10 whitespace-nowrap flex-shrink-0"
                        >
                            Side
                        </button>
                        <button
                            onClick={() => handlePreset("red")}
                            className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-red-400 hover:text-white hover:bg-red/20 transition border border-red/40 whitespace-nowrap flex-shrink-0"
                        >
                            Red
                        </button>
                        <button
                            onClick={() => handlePreset("blue")}
                            className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-blue-400 hover:text-white hover:bg-blue/20 transition border border-blue/40 whitespace-nowrap flex-shrink-0"
                        >
                            Blue
                        </button>
                        <button
                            onClick={() => handlePreset("summit")}
                            className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-amber-300 hover:text-white hover:bg-amber-400/20 transition border border-amber-400/40 whitespace-nowrap flex-shrink-0"
                        >
                            Summit
                        </button>
                    </div>

                    {/* View Tools */}
                    <div className="flex items-center gap-1 pointer-events-auto bg-black/90 backdrop-blur-md p-1 border border-white/15 self-end sm:self-auto">
                        <button
                            onClick={() => {
                                const next = !autoRotate;
                                setAutoRotate(next);
                                if (engineRef.current) engineRef.current.setAutoRotate(next);
                            }}
                            title="Auto Rotate"
                            className={`p-1.5 transition border ${
                                autoRotate
                                    ? "bg-red text-white border-red"
                                    : "text-gray-400 hover:text-white border-transparent"
                            }`}
                        >
                            <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                            onClick={() => {
                                const next = !showRobots;
                                setShowRobots(next);
                                if (engineRef.current) engineRef.current.setRobotsVisible(next);
                            }}
                            title="Toggle Robots (TR & BR)"
                            className={`p-1.5 transition border ${
                                showRobots
                                    ? "bg-white/15 text-white border-white/30"
                                    : "text-gray-500 hover:text-white border-transparent"
                            }`}
                        >
                            <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                            onClick={() => {
                                const next = !wireframe;
                                setWireframe(next);
                                if (engineRef.current) engineRef.current.setWireframe(next);
                            }}
                            title="Toggle Wireframe"
                            className={`p-1.5 transition border ${
                                wireframe
                                    ? "bg-amber-500 text-white border-amber-500"
                                    : "text-gray-400 hover:text-white border-transparent"
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                            onClick={() => {
                                const next = !isolate;
                                setIsolate(next);
                                if (engineRef.current) engineRef.current.setIsolate(next);
                            }}
                            title="Isolate Selection (Ghost others)"
                            className={`p-1.5 transition border ${
                                isolate
                                    ? "bg-cyan-500 text-white border-cyan-500"
                                    : "text-gray-400 hover:text-white border-transparent"
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                            onClick={handleScreenshot}
                            title="Save PNG Screenshot"
                            className="p-1.5 text-gray-400 hover:text-white border border-transparent transition"
                        >
                            <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            title="Toggle Fullscreen"
                            className="p-1.5 text-gray-400 hover:text-white border border-transparent transition"
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            ) : (
                                <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                        </button>
                    </div>
                </div>

                {/* MODE 1 OVERLAY: GUIDED TOUR CONTROL DOCK */}
                {mode === "tour" && (
                    <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-auto sm:max-w-md pointer-events-auto bg-black/95 backdrop-blur-md p-3 sm:p-4 border border-white/20 text-white space-y-2.5 sm:space-y-3 max-h-[48%] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 sm:pb-2">
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-red">
                                Step {String(tourStep + 1).padStart(2, "0")} / {TOUR_STEPS.length}
                            </span>
                            <span className="text-xs text-gray-400 truncate max-w-[200px]">
                                {TOUR_STEPS[tourStep].title}
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1 bg-white/10">
                            <div
                                className="h-full bg-red transition-all duration-300"
                                style={{
                                    width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%`,
                                }}
                            />
                        </div>

                        <p className="text-[11px] sm:text-xs text-gray-300 leading-relaxed max-h-20 sm:max-h-24 overflow-y-auto">
                            {selectedPart?.desc || "Explore each element of the Robocon 2027 Arena."}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                            <button
                                disabled={tourStep === 0}
                                onClick={() => goToTourStep(tourStep - 1)}
                                className="px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold border border-white/20 bg-white/5 text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" /> Back
                            </button>

                            <button
                                onClick={() => goToTourStep((tourStep + 1) % TOUR_STEPS.length)}
                                className="px-3 py-1 sm:px-4 sm:py-1.5 text-xs font-bold border border-red bg-red text-white hover:bg-red/80 flex items-center gap-1 transition"
                            >
                                {tourStep === TOUR_STEPS.length - 1 ? "Restart" : "Next"}{" "}
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* MODE 2 OVERLAY: MATCH SIMULATOR DOCK */}
                {mode === "match" && (
                    <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-auto sm:max-w-lg pointer-events-auto bg-black/95 backdrop-blur-md p-3 sm:p-4 border border-white/20 text-white space-y-2.5 sm:space-y-3 max-h-[55%] overflow-y-auto">
                        {/* Scoreline */}
                        <div className="grid grid-cols-3 items-center text-center border-b border-white/10 pb-2">
                            <div className="border-r border-white/10">
                                <span className="block text-[9px] sm:text-[10px] uppercase font-bold text-red">Red Team</span>
                                <span className="text-xl sm:text-2xl font-black text-red">{redScore}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] sm:text-[10px] uppercase font-bold text-gray-400">Clock</span>
                                <span className="text-lg sm:text-xl font-mono font-bold text-white">
                                    {formatClock(simTime)}
                                </span>
                            </div>
                            <div className="border-l border-white/10">
                                <span className="block text-[9px] sm:text-[10px] uppercase font-bold text-blue-400">Blue Team</span>
                                <span className="text-xl sm:text-2xl font-black text-blue-400">{blueScore}</span>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="px-2.5 py-1 border border-red bg-red text-white text-xs font-bold flex items-center gap-1 hover:bg-red/80 transition"
                                >
                                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    {isPlaying ? "Pause" : "Play"}
                                </button>
                                <button
                                    onClick={resetMatch}
                                    title="Reset Match"
                                    className="px-2 py-1 border border-white/20 bg-white/5 text-gray-300 hover:text-white text-xs font-bold transition"
                                >
                                    <SkipBack className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={180}
                                step={0.5}
                                value={simTime}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setSimTime(val);
                                    if (engineRef.current) {
                                        engineRef.current.updateMatchSimTime(val);
                                    }
                                }}
                                className="flex-1 min-w-[100px] accent-red cursor-pointer"
                            />
                            <div className="flex items-center gap-1 text-[10px] sm:text-[11px]">
                                {[1, 2, 4].map((spd) => (
                                    <button
                                        key={spd}
                                        onClick={() => setSimSpeed(spd)}
                                        className={`px-1.5 py-0.5 border ${
                                            simSpeed === spd
                                                ? "border-red text-red font-bold"
                                                : "border-white/10 text-gray-400"
                                        }`}
                                    >
                                        {spd}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Event Feed */}
                        <div className="max-h-16 overflow-y-auto space-y-0.5 text-[10px] sm:text-[11px] font-mono text-gray-300 border-t border-white/10 pt-1.5">
                            {matchLog.slice(0, 3).map((log, i) => (
                                <p key={i} className="truncate text-gray-300">
                                    • {log}
                                </p>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Selected Object Detail Card */}
            {selectedPart && (
                <div className="border border-white/15 bg-black p-4 sm:p-5 text-white space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red/20 text-red border border-red/40">
                                {selectedPart.eye}
                            </span>
                            <h3 className="text-base sm:text-lg font-bold text-white">
                                {selectedPart.title}
                            </h3>
                        </div>
                        {selectedPart.ruleRef && (
                            <span className="text-xs text-gray-400">
                                Rule Ref: <strong className="text-gray-200">{selectedPart.ruleRef}</strong>
                            </span>
                        )}
                    </div>

                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                        {selectedPart.desc}
                    </p>

                    {selectedPart.specs && selectedPart.specs.length > 0 && (
                        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                            {selectedPart.specs.map(([lbl, val]) => (
                                <div key={lbl} className="border border-white/10 p-2.5 bg-white/5">
                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">
                                        {lbl}
                                    </span>
                                    <span className="font-semibold text-white">{val}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
