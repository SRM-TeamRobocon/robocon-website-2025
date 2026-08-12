"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCw, Undo2 } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { RECRUIT_SUBDOMAINS, subDomainFullLabel } from "@/lib/recruit-domains";
import RecruitBackdrop from "@/components/recruit/RecruitBackdrop";
import GlassCard from "@/components/recruit/GlassCard";
import Select from "@/components/ui/select";

const Html5QrcodeScanner = dynamic(() => import("@/components/recruit/Html5QrcodeScanner"), {
    ssr: false,
});

type Mode = "orientation" | "exam_day_1" | "exam_day_2" | "interview" | "training";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
    { value: "orientation", label: "Orientation" },
    { value: "exam_day_1", label: "Exam — Day 1" },
    { value: "exam_day_2", label: "Exam — Day 2" },
    { value: "interview", label: "Interview Check-In" },
    { value: "training", label: "Training" },
];

type Panel = { id: string; domain_label: string; is_active?: boolean };

type ScanResult = {
    status: "ok" | "already_scanned" | "already_checked_in" | "error";
    name: string;
    message: string;
    token_number?: number;
    panel_label?: string;
    // Training only: the id of the auto-created (day, domain) session the scan landed in.
    // The scanner never picks a session any more, so this is the only way Undo can name one.
    session_id?: string;
};

// What a recorded scan can be undone as. Interview check-ins have no undo here —
// removing someone from a live token queue is a queue operation, not an attendance
// delete, and belongs on the interview dashboard.
type UndoTarget =
    | { type: "orientation" }
    | { type: "exam"; sub_domain: string }
    | { type: "training"; session_id: string }
    | null;

type RecentScan = {
    key: string;
    recruitId: string | null;
    name: string;
    what: string;
    at: number;
    undo: UndoTarget;
    state: "done" | "undoing" | "undone";
    note: string | null;
};

const MAX_RECENT = 10;

// Other agents' routes may not exist yet — fetch tolerantly and just show an empty
// dropdown rather than blowing up the page if they 404 or return an unexpected shape.
async function safeFetchList<T>(url: string): Promise<T[]> {
    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        if (Array.isArray(json?.data)) return json.data as T[];
        if (Array.isArray(json)) return json as T[];
        return [];
    } catch {
        return [];
    }
}

// The QR payload is base64url JSON of { rid, cid, sig }. The signature can only be
// checked server-side (QR_SECRET never reaches the browser), but reading `rid` here is
// enough to offer an undo — the DELETE endpoint re-validates the recruit against the
// active cycle and requires lead/admin anyway.
function recruitIdFromPayload(payload: string): string | null {
    try {
        const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const parsed = JSON.parse(atob(padded));
        return typeof parsed?.rid === "string" ? parsed.rid : null;
    } catch {
        return null;
    }
}

function beep() {
    try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.start();
        setTimeout(() => osc.stop(), 120);
    } catch {
        // Audio isn't essential to the scan flow — ignore failures (e.g. no user gesture yet).
    }
}

function clockTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function RecruitScannerPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);

    const [panels, setPanels] = useState<Panel[]>([]);
    const [panelsLoading, setPanelsLoading] = useState(false);

    const [selectedMode, setSelectedMode] = useState<Mode>("orientation");
    const [panelId, setPanelId] = useState<string>("");
    const [examSubDomain, setExamSubDomain] = useState<string>("");
    const [trainingSubDomain, setTrainingSubDomain] = useState<string>("");

    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [flash, setFlash] = useState<"success" | "warn" | "error" | null>(null);
    const [recent, setRecent] = useState<RecentScan[]>([]);

    // Refs so the html5-qrcode onScan callback (registered once when scanning starts) always
    // reads current mode/selection state instead of a stale closure.
    const modeRef = useRef(selectedMode);
    const panelIdRef = useRef(panelId);
    const examSubDomainRef = useRef(examSubDomain);
    const trainingSubDomainRef = useRef(trainingSubDomain);
    const scanLockRef = useRef(false);

    useEffect(() => {
        modeRef.current = selectedMode;
    }, [selectedMode]);
    useEffect(() => {
        panelIdRef.current = panelId;
    }, [panelId]);
    useEffect(() => {
        examSubDomainRef.current = examSubDomain;
    }, [examSubDomain]);
    useEffect(() => {
        trainingSubDomainRef.current = trainingSubDomain;
    }, [trainingSubDomain]);

    const refreshPanels = useCallback(async () => {
        setPanelsLoading(true);
        try {
            const list = await safeFetchList<Panel>("/api/admin/recruitment/panels?active=true");
            setPanels(list);
            // Drop a selection that no longer exists (panel closed since it was picked).
            setPanelId((current) => (current && !list.some((p) => p.id === current) ? "" : current));
        } finally {
            setPanelsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshPanels();
    }, [refreshPanels]);

    // Panels are opened ON the day, often after a volunteer has already opened this page.
    // Re-fetch when switching into interview mode so "No active panels found" can't be a
    // permanently stale answer. Training needs no such fetch any more — the volunteer
    // picks a domain from a static list and the session is created by the first scan.
    useEffect(() => {
        if (selectedMode === "interview") refreshPanels();
    }, [selectedMode, refreshPanels]);

    const isExamMode = selectedMode === "exam_day_1" || selectedMode === "exam_day_2";

    const canStart = isExamMode
        ? Boolean(examSubDomain)
        : selectedMode === "interview"
            ? Boolean(panelId)
            : selectedMode === "training"
                ? Boolean(trainingSubDomain)
                : true;

    const recordScan = useCallback((decodedText: string, mode: Mode, result: ScanResult) => {
        const recruitId = recruitIdFromPayload(decodedText);

        let what: string;
        let undo: UndoTarget;

        if (mode === "orientation") {
            what = "Orientation";
            undo = { type: "orientation" };
        } else if (mode === "exam_day_1" || mode === "exam_day_2") {
            const sub = examSubDomainRef.current;
            what = `${subDomainFullLabel(sub)} exam — Day ${mode === "exam_day_1" ? 1 : 2}`;
            undo = { type: "exam", sub_domain: sub };
        } else if (mode === "training") {
            what = `Training — ${subDomainFullLabel(trainingSubDomainRef.current)}`;
            // The session is created server-side, so its id only exists in the response.
            // Without it there's nothing to undo against, hence the null fallback.
            undo = result.session_id ? { type: "training", session_id: result.session_id } : null;
        } else {
            what = "Interview check-in";
            undo = null;
        }

        setRecent((prev) =>
            [
                {
                    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    recruitId,
                    name: result.name || "Unknown recruit",
                    what,
                    at: Date.now(),
                    undo,
                    state: "done" as const,
                    note: recruitId ? null : "Could not read the QR id — undo from the dashboard.",
                },
                ...prev,
            ].slice(0, MAX_RECENT)
        );
    }, []);

    const handleScan = useCallback(async (decodedText: string) => {
        if (scanLockRef.current) return;
        scanLockRef.current = true;

        const mode = modeRef.current;
        const payload = decodedText.trim();
        const body: { payload: string; mode: Mode; panel_id?: string; sub_domain?: string } = {
            payload,
            mode,
        };
        if (mode === "interview") body.panel_id = panelIdRef.current;
        if (mode === "training") body.sub_domain = trainingSubDomainRef.current;
        if (mode === "exam_day_1" || mode === "exam_day_2") body.sub_domain = examSubDomainRef.current;

        try {
            const res = await fetch("/api/admin/recruitment/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json: ScanResult = await res.json();

            setResult(json);
            if (json.status === "ok") {
                setFlash("success");
                beep();
                recordScan(payload, mode, json);
            } else if (json.status === "already_scanned" || json.status === "already_checked_in") {
                setFlash("warn");
                beep();
            } else {
                setFlash("error");
            }
        } catch {
            setResult({ status: "error", name: "", message: "Network error while scanning." });
            setFlash("error");
        } finally {
            setTimeout(() => {
                scanLockRef.current = false;
                setResult(null);
                setFlash(null);
            }, 2500);
        }
    }, [recordScan]);

    const undoScan = useCallback(async (entry: RecentScan) => {
        if (!entry.undo || !entry.recruitId) return;

        setRecent((prev) => prev.map((r) => (r.key === entry.key ? { ...r, state: "undoing", note: null } : r)));

        try {
            const res = await fetch("/api/admin/recruitment/attendance", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...entry.undo, recruit_id: entry.recruitId }),
            });

            if (res.status === 403) {
                setRecent((prev) =>
                    prev.map((r) =>
                        r.key === entry.key
                            ? { ...r, state: "done", note: "Undo needs a lead or admin — ask a lead to undo this." }
                            : r
                    )
                );
                return;
            }

            const json = await res.json().catch(() => null);

            if (!res.ok || !json?.success) {
                setRecent((prev) =>
                    prev.map((r) =>
                        r.key === entry.key
                            ? { ...r, state: "done", note: json?.error || "Could not undo this scan." }
                            : r
                    )
                );
                return;
            }

            setRecent((prev) =>
                prev.map((r) =>
                    r.key === entry.key
                        ? { ...r, state: "undone", note: json.removed === 0 ? "Nothing was recorded to undo." : null }
                        : r
                )
            );
        } catch {
            setRecent((prev) =>
                prev.map((r) => (r.key === entry.key ? { ...r, state: "done", note: "Network error — try again." } : r))
            );
        }
    }, []);

    if (!ready) return null;

    const activePanelLabel = panels.find((p) => p.id === panelId)?.domain_label;
    const activeTrainingLabel = trainingSubDomain ? subDomainFullLabel(trainingSubDomain) : "";

    const refreshButton = (onClick: () => void, loading: boolean, label: string) => (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            title={label}
            aria-label={label}
            className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-white/50 hover:text-white hover:border-white/30 disabled:opacity-50 transition-colors"
        >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
    );

    return (
        <div className="min-h-screen relative z-10 px-4 py-8 md:py-12">
            <RecruitBackdrop />
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Recruitment Scanner</h1>
                    <p className="text-sm text-white/60 mt-2">Scan recruit QR codes for orientation, exams, interviews, and training.</p>
                </div>

                {!scanning ? (
                    <GlassCard contentClassName="p-6 md:p-8 space-y-6" borderRadius={28}>
                        <p className="text-xs uppercase tracking-widest font-bold text-white/40">Select scan mode</p>

                        <div className="space-y-3">
                            {MODE_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMode === opt.value
                                        ? "border-red bg-red/10"
                                        : "border-white/15 hover:border-white/30"
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="scan-mode"
                                        value={opt.value}
                                        checked={selectedMode === opt.value}
                                        onChange={() => setSelectedMode(opt.value)}
                                        className="accent-red"
                                    />
                                    <span className="font-semibold text-sm text-white">{opt.label}</span>
                                </label>
                            ))}
                        </div>

                        {isExamMode && (
                            <div>
                                <label className="block text-xs uppercase tracking-widest font-bold text-white/40 mb-2">
                                    Which exam?
                                </label>
                                <Select
                                    value={examSubDomain}
                                    onChange={setExamSubDomain}
                                    placeholder="Select the exam domain..."
                                    options={RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: `${d.subsystem} — ${d.label}` }))}
                                />
                                <p className="mt-2 text-xs text-white/40">
                                    Attendance is recorded per exam, so a recruit sitting two different domain exams is
                                    scanned once for each.
                                </p>
                            </div>
                        )}

                        {selectedMode === "interview" && (
                            <div>
                                <label className="block text-xs uppercase tracking-widest font-bold text-white/40 mb-2">
                                    Panel
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <Select
                                            value={panelId}
                                            onChange={setPanelId}
                                            placeholder={
                                                panelsLoading
                                                    ? "Loading panels..."
                                                    : panels.length === 0
                                                        ? "No active panels found"
                                                        : "Select a panel..."
                                            }
                                            options={panels.map((p) => ({ value: p.id, label: p.domain_label }))}
                                        />
                                    </div>
                                    {refreshButton(refreshPanels, panelsLoading, "Refresh panels")}
                                </div>
                                <p className="mt-2 text-xs text-white/40">
                                    Panels are opened on the day — hit refresh if the one you need isn&apos;t listed yet.
                                </p>
                            </div>
                        )}

                        {selectedMode === "training" && (
                            <div>
                                <label className="block text-xs uppercase tracking-widest font-bold text-white/40 mb-2">
                                    Training domain
                                </label>
                                <Select
                                    value={trainingSubDomain}
                                    onChange={setTrainingSubDomain}
                                    placeholder="Select the training domain..."
                                    options={RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: `${d.subsystem} — ${d.label}` }))}
                                />
                                <p className="mt-2 text-xs text-white/40">
                                    Everyone you scan is marked present for this domain&apos;s training today. Nothing to
                                    set up first — today&apos;s session opens automatically on the first scan.
                                </p>
                            </div>
                        )}

                        <button
                            type="button"
                            disabled={!canStart}
                            onClick={() => setScanning(true)}
                            className="w-full rounded-xl px-4 py-3 font-bold text-sm text-white bg-red hover:bg-red/90 active:scale-[0.99] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-red/25"
                        >
                            Start Scanning
                        </button>
                    </GlassCard>
                ) : (
                    <div className="space-y-4">
                        <GlassCard contentClassName="px-4 py-3 flex items-center justify-between" borderRadius={20}>
                            <div className="text-sm">
                                <span className="text-white/40 uppercase tracking-widest text-xs font-bold mr-2">Mode</span>
                                <span className="font-bold text-white">
                                    {MODE_OPTIONS.find((m) => m.value === selectedMode)?.label}
                                    {isExamMode && examSubDomain ? ` · ${subDomainFullLabel(examSubDomain)}` : ""}
                                    {selectedMode === "interview" && activePanelLabel ? ` · ${activePanelLabel}` : ""}
                                    {selectedMode === "training" && activeTrainingLabel ? ` · ${activeTrainingLabel}` : ""}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setScanning(false);
                                    setResult(null);
                                    setFlash(null);
                                }}
                                className="text-xs font-bold uppercase tracking-widest text-red hover:text-red/80 border border-red/40 rounded-lg px-3 py-1.5 transition-colors"
                            >
                                Change Mode
                            </button>
                        </GlassCard>

                        <GlassCard
                            contentClassName="relative p-4 md:p-6"
                            borderRadius={28}
                            className={`transition-all duration-200 ${flash === "success"
                                ? "ring-2 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                                : flash === "warn"
                                    ? "ring-2 ring-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]"
                                    : flash === "error"
                                        ? "ring-2 ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                                        : ""
                                }`}
                        >
                            {result && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md" style={{ backgroundColor: "rgba(3, 7, 18, 0.95)" }}>
                                    <div className="text-center max-w-sm w-full">
                                        <h2
                                            className="text-2xl font-black mb-2"
                                            style={{
                                                color:
                                                    result.status === "ok"
                                                        ? "#34d399"
                                                        : result.status === "already_scanned" || result.status === "already_checked_in"
                                                            ? "#fbbf24"
                                                            : "#ef4444",
                                            }}
                                        >
                                            {result.status === "ok"
                                                ? "Scan OK"
                                                : result.status === "already_scanned"
                                                    ? "Already Scanned"
                                                    : result.status === "already_checked_in"
                                                        ? "Already Checked In"
                                                        : "Scan Failed"}
                                        </h2>
                                        {result.name && <p className="text-white font-bold text-lg">{result.name}</p>}
                                        <p className="text-gray-300 text-sm mt-1">{result.message}</p>
                                        {typeof result.token_number === "number" && (
                                            <p className="mt-3 inline-block bg-black/50 border border-gray-700 rounded-xl px-4 py-2 font-mono text-lg font-bold text-white">
                                                Token #{result.token_number}
                                                {result.panel_label ? ` — ${result.panel_label}` : ""}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <Html5QrcodeScanner onScan={handleScan} />
                        </GlassCard>
                    </div>
                )}

                {recent.length > 0 && (
                    <GlassCard contentClassName="p-4 md:p-6" borderRadius={28}>
                        <div className="flex items-baseline justify-between gap-3 mb-3">
                            <p className="text-xs uppercase tracking-widest font-bold text-white/40">
                                Recent scans (this device)
                            </p>
                            <button
                                type="button"
                                onClick={() => setRecent([])}
                                className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors"
                            >
                                Clear
                            </button>
                        </div>

                        <ul className="divide-y divide-white/10">
                            {recent.map((entry) => (
                                <li key={entry.key} className="py-3 flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={`font-bold text-sm truncate ${entry.state === "undone" ? "text-white/35 line-through" : "text-white"
                                                }`}
                                        >
                                            {entry.name}
                                        </p>
                                        <p className="text-xs text-white/50 mt-0.5">
                                            {entry.what} · {clockTime(entry.at)}
                                        </p>
                                        {entry.note && <p className="text-xs text-amber-300 mt-1">{entry.note}</p>}
                                        {entry.state === "undone" && !entry.note && (
                                            <p className="text-xs text-emerald-300 mt-1">Undone.</p>
                                        )}
                                    </div>

                                    {entry.undo && entry.recruitId && entry.state !== "undone" ? (
                                        <button
                                            type="button"
                                            onClick={() => undoScan(entry)}
                                            disabled={entry.state === "undoing"}
                                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white hover:border-white/30 disabled:opacity-50 transition-colors"
                                        >
                                            <Undo2 className="w-3.5 h-3.5" />
                                            {entry.state === "undoing" ? "Undoing" : "Undo"}
                                        </button>
                                    ) : !entry.undo ? (
                                        <span className="shrink-0 text-[10px] uppercase tracking-widest font-bold text-white/30 pt-1.5">
                                            Interview queue
                                        </span>
                                    ) : null}
                                </li>
                            ))}
                        </ul>

                        <p className="mt-3 text-xs text-white/40">
                            Only scans made on this device are listed, and only until the page is reloaded. Undo requires a
                            lead or admin login.
                        </p>
                    </GlassCard>
                )}
            </div>
        </div>
    );
}
