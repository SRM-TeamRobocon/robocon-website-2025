"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Undo2 } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { RECRUIT_SUBDOMAINS, subDomainFullLabel } from "@/lib/recruit-domains";
import RecruitBackdrop from "@/components/recruit/RecruitBackdrop";
import Select from "@/components/ui/select";

const Html5QrcodeScanner = dynamic(() => import("@/components/recruit/Html5QrcodeScanner"), {
    ssr: false,
});

type Mode = "orientation" | "exam_day_1" | "exam_day_2" | "interview" | "training";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
    { value: "orientation", label: "Orientation" },
    { value: "exam_day_1", label: "Exam: Day 1" },
    { value: "exam_day_2", label: "Exam: Day 2" },
    { value: "interview", label: "Interview Check-In" },
    { value: "training", label: "Training" },
];

type ScanResult = {
    status: "ok" | "already_scanned" | "already_checked_in" | "not_shortlisted" | "error";
    name: string;
    message: string;
    token_number?: number;
    panel_label?: string;
    // Training only: the id of the auto-created (day, domain) session the scan landed in.
    // The scanner never picks a session any more, so this is the only way Undo can name one.
    session_id?: string;
};

// Held while a "not shortlisted" interview check-in is waiting on a human decision — the
// scan endpoint deliberately doesn't check anyone in until the volunteer/lead confirms a
// walk-in, so this is what the confirm button re-sends with `force: true`. Either payload
// (QR) or recruit_id (manual entry) is set, matching whichever path triggered the gate.
type PendingWalkin = {
    payload?: string;
    recruit_id?: string;
    mode: Mode;
    sub_domain?: string;
    name: string;
};

// One row of the "who's been marked present" table below the scanner — backed by
// GET /api/admin/recruitment/scan/roster, scoped to the currently selected mode/domain.
type RosterEntry = {
    recruit_id: string;
    name: string;
    reg_no: string;
    at: string;
    status?: string;
    token_number?: number;
    method?: string;
};

type RecruitSearchResult = {
    id: string;
    name: string;
    reg_no: string;
    department?: string;
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

    const [selectedMode, setSelectedMode] = useState<Mode>("orientation");
    const [interviewSubDomain, setInterviewSubDomain] = useState<string>("");
    const [examSubDomain, setExamSubDomain] = useState<string>("");
    const [trainingSubDomain, setTrainingSubDomain] = useState<string>("");

    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [flash, setFlash] = useState<"success" | "warn" | "error" | null>(null);
    const [recent, setRecent] = useState<RecentScan[]>([]);

    // Live roster ("who's been marked present for this mode") + manual entry fallback.
    const [roster, setRoster] = useState<RosterEntry[]>([]);
    const [rosterLoading, setRosterLoading] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [manualQuery, setManualQuery] = useState("");
    const [manualResults, setManualResults] = useState<RecruitSearchResult[]>([]);
    const [manualSearching, setManualSearching] = useState(false);
    const [manualSubmitting, setManualSubmitting] = useState(false);

    // Refs so the html5-qrcode onScan callback (registered once when scanning starts) always
    // reads current mode/selection state instead of a stale closure.
    const modeRef = useRef(selectedMode);
    const interviewSubDomainRef = useRef(interviewSubDomain);
    const examSubDomainRef = useRef(examSubDomain);
    const trainingSubDomainRef = useRef(trainingSubDomain);
    const scanLockRef = useRef(false);

    useEffect(() => {
        modeRef.current = selectedMode;
    }, [selectedMode]);
    useEffect(() => {
        interviewSubDomainRef.current = interviewSubDomain;
    }, [interviewSubDomain]);
    useEffect(() => {
        examSubDomainRef.current = examSubDomain;
    }, [examSubDomain]);
    useEffect(() => {
        trainingSubDomainRef.current = trainingSubDomain;
    }, [trainingSubDomain]);

    const isExamMode = selectedMode === "exam_day_1" || selectedMode === "exam_day_2";

    const canStart = isExamMode
        ? Boolean(examSubDomain)
        : selectedMode === "interview"
            ? Boolean(interviewSubDomain)
            : selectedMode === "training"
                ? Boolean(trainingSubDomain)
                : true;

    const recordScan = useCallback((recruitId: string | null, mode: Mode, result: ScanResult, isWalkin = false) => {
        let what: string;
        let undo: UndoTarget;

        if (mode === "orientation") {
            what = "Orientation";
            undo = { type: "orientation" };
        } else if (mode === "exam_day_1" || mode === "exam_day_2") {
            const sub = examSubDomainRef.current;
            what = `${subDomainFullLabel(sub)} exam: Day ${mode === "exam_day_1" ? 1 : 2}`;
            undo = { type: "exam", sub_domain: sub };
        } else if (mode === "training") {
            what = `Training: ${subDomainFullLabel(trainingSubDomainRef.current)}`;
            // The session is created server-side, so its id only exists in the response.
            // Without it there's nothing to undo against, hence the null fallback.
            undo = result.session_id ? { type: "training", session_id: result.session_id } : null;
        } else {
            what = `Interview check-in: ${subDomainFullLabel(interviewSubDomainRef.current)}${isWalkin ? " (walk-in)" : ""}`;
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
                    note: recruitId ? null : "Could not read the QR id. Undo from the dashboard.",
                },
                ...prev,
            ].slice(0, MAX_RECENT)
        );
    }, []);

    const [pendingWalkin, setPendingWalkin] = useState<PendingWalkin | null>(null);

    // Which sub_domain (if any) the roster/manual-entry features should scope to, matching
    // whichever selector is active for the current mode.
    const activeSubDomain =
        selectedMode === "exam_day_1" || selectedMode === "exam_day_2"
            ? examSubDomain
            : selectedMode === "interview"
                ? interviewSubDomain
                : selectedMode === "training"
                    ? trainingSubDomain
                    : undefined;

    const fetchRoster = useCallback(async () => {
        if (!scanning) return;
        if (selectedMode !== "orientation" && !activeSubDomain) return;
        setRosterLoading(true);
        try {
            const params = new URLSearchParams({ mode: selectedMode });
            if (activeSubDomain) params.set("sub_domain", activeSubDomain);
            const res = await fetch(`/api/admin/recruitment/scan/roster?${params.toString()}`);
            const data = await res.json();
            if (data.success) setRoster(data.data);
        } catch {
            // Non-critical — the roster table just stays stale until the next poll.
        } finally {
            setRosterLoading(false);
        }
    }, [scanning, selectedMode, activeSubDomain]);

    useEffect(() => {
        if (!scanning) return;
        fetchRoster();
        const interval = setInterval(fetchRoster, 8000);
        return () => clearInterval(interval);
    }, [scanning, fetchRoster]);

    // Releases the scan lock and clears the overlay after a delay — shared by every path
    // EXCEPT "not shortlisted", which instead waits on a human decision (see below). A clean
    // "ok" is confirmed by the beep + green flash alone, so it doesn't need as long on screen
    // as a warning/error the volunteer actually has to read before scanning the next person —
    // holding every outcome to the same 2.5s was the single biggest thing making back-to-back
    // scanning feel slow.
    const scheduleReset = useCallback((ms: number) => {
        setTimeout(() => {
            scanLockRef.current = false;
            setResult(null);
            setFlash(null);
        }, ms);
    }, []);

    // Shared by the QR scan path, the manual-entry fallback, and the forced walk-in retry —
    // `force: true` on the body is what tells the server to bypass the "not shortlisted"
    // gate for mode 'interview'. Exactly one of payload/recruit_id is set.
    const runScan = useCallback(
        async (body: { payload?: string; recruit_id?: string; mode: Mode; sub_domain?: string; force?: boolean }) => {
            const recruitId = body.recruit_id ?? (body.payload ? recruitIdFromPayload(body.payload) : null);
            try {
                const res = await fetch("/api/admin/recruitment/scan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                const json: ScanResult = await res.json();

                setResult(json);

                if (json.status === "not_shortlisted") {
                    // Hold the lock and the overlay open — nothing is checked in yet, and
                    // scanning again while this is up would be confusing. The decision
                    // buttons below (confirmWalkin/cancelWalkin) resolve it.
                    setPendingWalkin({
                        payload: body.payload,
                        recruit_id: body.recruit_id,
                        mode: body.mode,
                        sub_domain: body.sub_domain,
                        name: json.name,
                    });
                    setFlash("warn");
                    beep();
                    return;
                }

                if (json.status === "ok") {
                    setFlash("success");
                    beep();
                    recordScan(recruitId, body.mode, json, body.force === true);
                    scheduleReset(900);
                    fetchRoster();
                } else if (json.status === "already_scanned" || json.status === "already_checked_in") {
                    setFlash("warn");
                    beep();
                    scheduleReset(2500);
                } else {
                    setFlash("error");
                    scheduleReset(2500);
                }
            } catch {
                setResult({ status: "error", name: "", message: "Network error while scanning." });
                setFlash("error");
                scheduleReset(2500);
            }
        },
        [recordScan, scheduleReset, fetchRoster]
    );

    const handleScan = useCallback(
        async (decodedText: string) => {
            if (scanLockRef.current) return;
            scanLockRef.current = true;

            const mode = modeRef.current;
            const payload = decodedText.trim();
            const body: { payload: string; mode: Mode; sub_domain?: string } = {
                payload,
                mode,
            };
            if (mode === "interview") body.sub_domain = interviewSubDomainRef.current;
            if (mode === "training") body.sub_domain = trainingSubDomainRef.current;
            if (mode === "exam_day_1" || mode === "exam_day_2") body.sub_domain = examSubDomainRef.current;

            await runScan(body);
        },
        [runScan]
    );

    // Volunteer/lead confirms a walk-in: re-send the same payload/recruit_id with
    // force: true so the server bypasses the shortlist gate this one time and checks the
    // recruit in.
    const confirmWalkin = useCallback(async () => {
        if (!pendingWalkin) return;
        const { payload, recruit_id, mode, sub_domain } = pendingWalkin;
        setPendingWalkin(null);
        await runScan({ payload, recruit_id, mode, sub_domain, force: true });
    }, [pendingWalkin, runScan]);

    // Manual-entry search — debounced, only while the panel is open. Reuses the existing
    // admin recruits list route rather than a dedicated endpoint; narrow search results
    // make the extra fields it also returns cheap to ignore.
    useEffect(() => {
        if (!showManualEntry) {
            setManualResults([]);
            return;
        }
        const q = manualQuery.trim();
        if (q.length < 2) {
            setManualResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setManualSearching(true);
            try {
                const res = await fetch(`/api/admin/recruitment/recruits?search=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (data.success) setManualResults((data.data || []).slice(0, 8));
            } catch {
                // Non-critical — an empty results list just reads as "no matches".
            } finally {
                setManualSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [manualQuery, showManualEntry]);

    const submitManualEntry = useCallback(
        async (recruit: RecruitSearchResult) => {
            if (scanLockRef.current) return;
            scanLockRef.current = true;
            setManualSubmitting(true);
            try {
                await runScan({ recruit_id: recruit.id, mode: selectedMode, sub_domain: activeSubDomain });
                setShowManualEntry(false);
                setManualQuery("");
                setManualResults([]);
            } finally {
                setManualSubmitting(false);
            }
        },
        [runScan, selectedMode, activeSubDomain]
    );

    // Volunteer/lead declines — nothing was ever checked in, so there's nothing to undo,
    // just release the lock so the next QR can be scanned.
    const cancelWalkin = useCallback(() => {
        setPendingWalkin(null);
        setResult(null);
        setFlash(null);
        scanLockRef.current = false;
    }, []);

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
                            ? { ...r, state: "done", note: "Undo needs a lead or admin. Ask a lead to undo this." }
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
                prev.map((r) => (r.key === entry.key ? { ...r, state: "done", note: "Network error, try again." } : r))
            );
        }
    }, []);

    if (!ready) return null;

    const activeInterviewLabel = interviewSubDomain ? subDomainFullLabel(interviewSubDomain) : "";
    const activeTrainingLabel = trainingSubDomain ? subDomainFullLabel(trainingSubDomain) : "";

    return (
        <div className="min-h-screen relative z-10 px-4 py-8 md:py-12">
            <RecruitBackdrop />
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Recruitment Scanner</h1>
                    <p className="text-sm text-white/60 mt-2">Scan recruit QR codes for orientation, exams, interviews, and training.</p>
                </div>

                {!scanning ? (
                    <div className="border-2 border-red bg-black p-6 md:p-8 space-y-6">
                        <p className="text-xs uppercase tracking-widest font-bold text-white/40">Select scan mode</p>

                        <div className="space-y-3">
                            {MODE_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-3 p-3 border cursor-pointer transition-all ${selectedMode === opt.value
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
                                    options={RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: `${d.subsystem}: ${d.label}` }))}
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
                                    Which domain?
                                </label>
                                <Select
                                    value={interviewSubDomain}
                                    onChange={setInterviewSubDomain}
                                    placeholder="Select the interview domain..."
                                    options={RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: `${d.subsystem}: ${d.label}` }))}
                                />
                                <p className="mt-2 text-xs text-white/40">
                                    Each scan is sent to whichever open table for this domain has the shortest line,
                                    no need to pick a specific table.
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
                                    options={RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: `${d.subsystem}: ${d.label}` }))}
                                />
                                <p className="mt-2 text-xs text-white/40">
                                    Everyone you scan is marked present for this domain&apos;s training today. Nothing to
                                    set up first. Today&apos;s session opens automatically on the first scan.
                                </p>
                            </div>
                        )}

                        <button
                            type="button"
                            disabled={!canStart}
                            onClick={() => setScanning(true)}
                            className="w-full px-4 py-3 font-bold text-sm text-white bg-red hover:bg-red/90 active:scale-[0.99] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-red/25"
                        >
                            Start Scanning
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="border-2 border-red bg-black px-4 py-3 flex items-center justify-between">
                            <div className="text-sm">
                                <span className="text-white/40 uppercase tracking-widest text-xs font-bold mr-2">Mode</span>
                                <span className="font-bold text-white">
                                    {MODE_OPTIONS.find((m) => m.value === selectedMode)?.label}
                                    {isExamMode && examSubDomain ? ` · ${subDomainFullLabel(examSubDomain)}` : ""}
                                    {selectedMode === "interview" && activeInterviewLabel ? ` · ${activeInterviewLabel}` : ""}
                                    {selectedMode === "training" && activeTrainingLabel ? ` · ${activeTrainingLabel}` : ""}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowManualEntry((v) => !v)}
                                    className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                                        showManualEntry
                                            ? "border-white/40 text-white bg-white/10"
                                            : "border-white/15 text-white/60 hover:text-white hover:border-white/30"
                                    }`}
                                >
                                    Manual Entry
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setScanning(false);
                                        setResult(null);
                                        setFlash(null);
                                    }}
                                    className="text-xs font-bold uppercase tracking-widest text-red hover:text-red/80 border border-red/40 px-3 py-1.5 transition-colors"
                                >
                                    Change Mode
                                </button>
                            </div>
                        </div>

                        {showManualEntry && (
                            <div className="border-2 border-red bg-black p-4 md:p-5 space-y-3">
                                <p className="text-xs uppercase tracking-widest font-bold text-white/40">
                                    Mark present without a QR: search by name or reg no
                                </p>
                                <input
                                    type="text"
                                    autoFocus
                                    value={manualQuery}
                                    onChange={(e) => setManualQuery(e.target.value)}
                                    placeholder="Start typing a name or registration number..."
                                    className="w-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
                                />
                                {manualSearching ? (
                                    <p className="text-xs text-white/40">Searching...</p>
                                ) : manualQuery.trim().length >= 2 && manualResults.length === 0 ? (
                                    <p className="text-xs text-white/40">No matches.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {manualResults.map((r) => (
                                            <button
                                                key={r.id}
                                                type="button"
                                                disabled={manualSubmitting}
                                                onClick={() => submitManualEntry(r)}
                                                className="w-full flex items-center justify-between border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:border-white/25 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                                            >
                                                <span className="text-sm font-semibold text-white">{r.name}</span>
                                                <span className="text-xs font-mono text-white/40">{r.reg_no}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div
                            className={`relative border-2 bg-black p-4 md:p-6 transition-colors duration-150 ${
                                flash === "success"
                                    ? "border-emerald-500"
                                    : flash === "warn"
                                        ? "border-amber-500"
                                        : flash === "error"
                                            ? "border-red-500"
                                            : "border-red"
                            }`}
                        >
                            {result && result.status === "not_shortlisted" && pendingWalkin ? (
                                <div className="absolute inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "rgba(3, 7, 18, 0.97)" }}>
                                    <div className="text-center max-w-sm w-full">
                                        <h2 className="text-2xl font-black mb-2" style={{ color: "#fbbf24" }}>
                                            Not Shortlisted
                                        </h2>
                                        {result.name && <p className="text-white font-bold text-lg">{result.name}</p>}
                                        <p className="text-gray-300 text-sm mt-1">{result.message}</p>
                                        <div className="mt-5 flex items-center justify-center gap-3">
                                            <button
                                                type="button"
                                                onClick={cancelWalkin}
                                                className="border border-white/20 px-4 py-2.5 text-sm font-bold text-white/70 hover:border-white/40 hover:text-white transition-colors"
                                            >
                                                Turn Away
                                            </button>
                                            <button
                                                type="button"
                                                onClick={confirmWalkin}
                                                className="bg-amber-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-400 transition-colors"
                                            >
                                                Allow Walk-in
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : result ? (
                                <div className="absolute inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "rgba(3, 7, 18, 0.97)" }}>
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
                                            <p className="mt-3 inline-block bg-black/50 border border-gray-700 px-4 py-2 font-mono text-lg font-bold text-white">
                                                Token #{result.token_number}
                                                {result.panel_label ? ` · ${result.panel_label}` : ""}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            <Html5QrcodeScanner onScan={handleScan} />
                        </div>

                        <div className="border-2 border-red bg-black p-4 md:p-6">
                            <div className="flex items-baseline justify-between gap-3 mb-3">
                                <p className="text-xs uppercase tracking-widest font-bold text-white/40">
                                    Checked in: {MODE_OPTIONS.find((m) => m.value === selectedMode)?.label}
                                    {isExamMode && examSubDomain ? ` · ${subDomainFullLabel(examSubDomain)}` : ""}
                                    {selectedMode === "interview" && activeInterviewLabel ? ` · ${activeInterviewLabel}` : ""}
                                    {selectedMode === "training" && activeTrainingLabel ? ` · ${activeTrainingLabel}` : ""}
                                </p>
                                <span className="text-xs font-mono text-white/30">{roster.length}</span>
                            </div>
                            {rosterLoading && roster.length === 0 ? (
                                <div className="space-y-2">
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} className="h-9 animate-pulse bg-white/5" />
                                    ))}
                                </div>
                            ) : roster.length === 0 ? (
                                <p className="text-sm text-white/40">Nobody scanned in for this mode yet.</p>
                            ) : (
                                <div className="max-h-80 overflow-y-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                                                <th className="pb-2 font-bold">Name</th>
                                                <th className="pb-2 font-bold">Reg No</th>
                                                {selectedMode === "interview" && <th className="pb-2 font-bold">Token</th>}
                                                <th className="pb-2 font-bold">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {roster.map((r) => (
                                                <tr key={r.recruit_id} className="border-b border-white/5">
                                                    <td className="py-2 font-semibold text-white">{r.name}</td>
                                                    <td className="py-2 font-mono text-xs text-white/50">{r.reg_no}</td>
                                                    {selectedMode === "interview" && (
                                                        <td className="py-2 font-mono text-xs text-white/50">
                                                            {typeof r.token_number === "number" ? `#${r.token_number}` : "—"}
                                                        </td>
                                                    )}
                                                    <td className="py-2 text-xs text-white/40">{clockTime(Date.parse(r.at))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {recent.length > 0 && (
                    <div className="border-2 border-red bg-black p-4 md:p-6">
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
                                            className="shrink-0 inline-flex items-center gap-1.5 border border-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white hover:border-white/30 disabled:opacity-50 transition-colors"
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
                    </div>
                )}
            </div>
        </div>
    );
}
