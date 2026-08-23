"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { CreditCard, ArrowLeft, AlertTriangle, LogOut, LogIn, Moon } from "lucide-react";
import { formatDuration, type AttendanceSession } from "@/lib/attendance";

// A `border` doesn't render along a clip-path's angled edge, so cards simulate the
// border with a ::before pseudo-element instead (see the `before:` classes below).
const CARD_CLIP_PATH = "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)";
const CARD_CLIP = { clipPath: CARD_CLIP_PATH, "--clip": CARD_CLIP_PATH } as any;
const PAIRING_POLL_MS = 2000;
const PAIRING_WINDOW_S = 60;

interface OvernightPass {
    id: string;
    nightOf: string;
    reason: string | null;
    expiresAt: string;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`relative isolate bg-white/[0.03] backdrop-blur-xl before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-white/10 ${className}`}
            style={CARD_CLIP}
        >
            {children}
        </div>
    );
}

function toLocalDatetimeValue(date: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function MyAttendancePage() {
    const [linked, setLinked] = useState(false);
    const [cardTail, setCardTail] = useState<string | null>(null);
    const [sessions, setSessions] = useState<AttendanceSession[]>([]);
    const [openSince, setOpenSince] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [pairing, setPairing] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [showCorrection, setShowCorrection] = useState<"checked_out_at" | "checked_in_at" | null>(null);
    const [correctionTime, setCorrectionTime] = useState("");
    const [submittingCorrection, setSubmittingCorrection] = useState(false);

    const [overnight, setOvernight] = useState<OvernightPass | null>(null);
    const [overnightReason, setOvernightReason] = useState("");
    const [savingOvernight, setSavingOvernight] = useState(false);

    const load = useCallback(() => {
        fetch("/api/member/attendance/me")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setLinked(data.linked);
                    setCardTail(data.cardTail);
                    setSessions(data.sessions || []);
                    setOpenSince(data.openSince);
                    setOvernight(data.overnight || null);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(load, [load]);

    const stopPairing = useCallback(() => {
        setPairing(false);
        if (pollRef.current) clearInterval(pollRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
    }, []);

    useEffect(() => stopPairing, [stopPairing]);

    const startPairing = async () => {
        try {
            const res = await fetch("/api/member/attendance/pair-start", { method: "POST" });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || "Could not start pairing.");
                return;
            }

            setPairing(true);
            setCountdown(PAIRING_WINDOW_S);
            countdownRef.current = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);

            pollRef.current = setInterval(async () => {
                const statusRes = await fetch(`/api/member/attendance/pair-status?id=${data.id}`);
                const statusData = await statusRes.json();
                if (!statusData.success) return;

                if (statusData.status === "claimed") {
                    stopPairing();
                    toast.success("Card linked! Tap it anywhere to check in/out.");
                    load();
                } else if (statusData.status === "expired" || statusData.status === "cancelled") {
                    stopPairing();
                    toast.error("Pairing window closed — no card was tapped in time. Try again.");
                }
            }, PAIRING_POLL_MS);
        } catch {
            toast.error("Could not start pairing.");
        }
    };

    const unlink = async () => {
        if (!confirm("Unlink your RFID card? You'll need to pair a new one to tap in/out again.")) return;
        const res = await fetch("/api/member/attendance/unlink", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.success) {
            toast.success("Card unlinked.");
            load();
        } else {
            toast.error(data.error || "Could not unlink card.");
        }
    };

    const claimOvernight = async () => {
        setSavingOvernight(true);
        try {
            const res = await fetch("/api/member/attendance/overnight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: overnightReason.trim() || undefined }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setOvernight(data.pass);
                setOvernightReason("");
                toast.success("Overnight pass on — you won't be auto-checked out tonight.");
            } else {
                toast.error(data.error || "Could not start your overnight pass.");
            }
        } catch {
            toast.error("Could not start your overnight pass.");
        } finally {
            setSavingOvernight(false);
        }
    };

    const cancelOvernight = async () => {
        setSavingOvernight(true);
        try {
            const res = await fetch("/api/member/attendance/overnight", { method: "DELETE" });
            const data = await res.json();
            if (res.ok && data.success) {
                setOvernight(null);
                toast.success("Overnight pass cancelled.");
            } else {
                toast.error(data.error || "Could not cancel your overnight pass.");
            }
        } catch {
            toast.error("Could not cancel your overnight pass.");
        } finally {
            setSavingOvernight(false);
        }
    };

    const openCorrection = (type: "checked_out_at" | "checked_in_at") => {
        setCorrectionTime(toLocalDatetimeValue(new Date()));
        setShowCorrection(type);
    };

    const submitCorrection = async () => {
        if (!correctionTime) return;
        setSubmittingCorrection(true);
        try {
            const res = await fetch("/api/member/attendance/correct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: showCorrection, time: new Date(correctionTime).toISOString() }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Attendance updated.");
                setShowCorrection(null);
                load();
            } else {
                toast.error(data.error || "Could not save correction.");
            }
        } finally {
            setSubmittingCorrection(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <Link href="/dashboard/attendance" className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-white transition">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to board
                </Link>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">My Attendance</h1>
                <p className="mt-2 text-sm text-gray-400 sm:text-base">Link your RFID card and fix any taps you missed.</p>
            </div>

            <Card className="p-5 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white">
                    <CreditCard className="h-4 w-4 text-red" /> RFID Card
                </h2>

                {loading ? (
                    <div className="h-10 w-48 animate-pulse bg-white/5" />
                ) : pairing ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-white">Tap your card on any scanner now…</p>
                            <p className="text-xs text-gray-500">Waiting {countdown}s</p>
                        </div>
                        <button onClick={stopPairing} className="w-fit border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white/10 transition">
                            Cancel
                        </button>
                    </div>
                ) : linked ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-300">
                            Linked to card ending in <span className="font-mono text-white">{cardTail}</span>
                        </p>
                        <button onClick={unlink} className="w-fit border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-red/10 hover:text-red transition">
                            Unlink
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-400">No card linked yet.</p>
                        <button onClick={startPairing} className="w-fit bg-red px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red/80 transition">
                            Link my RFID card
                        </button>
                    </div>
                )}
            </Card>

            <Card className={`p-5 sm:p-6 ${overnight ? "before:bg-indigo-400/30 bg-indigo-500/10" : ""}`}>
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white">
                    <Moon className="h-4 w-4 text-indigo-400" /> Staying overnight
                </h2>

                {loading ? (
                    <div className="h-10 w-56 animate-pulse bg-white/5" />
                ) : overnight ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-indigo-200">
                                Pass active for the night of {new Date(`${overnight.nightOf}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}.
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400">
                                Midnight auto-checkout will skip you tonight{overnight.reason ? ` — ${overnight.reason}` : ""}. Remember to tap out when you actually leave.
                            </p>
                        </div>
                        <button
                            onClick={cancelOvernight}
                            disabled={savingOvernight}
                            className="w-fit shrink-0 border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white/10 transition disabled:opacity-50"
                        >
                            Cancel pass
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-400">
                            Pulling an all-nighter? Turn this on and the midnight sweep won&apos;t check you out — good for exactly one night.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                type="text"
                                value={overnightReason}
                                onChange={(e) => setOvernightReason(e.target.value)}
                                placeholder="What are you working on? (optional)"
                                maxLength={200}
                                className="flex-1 border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-400/50 focus:outline-none"
                            />
                            <button
                                onClick={claimOvernight}
                                disabled={savingOvernight}
                                className="shrink-0 bg-indigo-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-indigo-500/80 transition disabled:opacity-50"
                            >
                                {savingOvernight ? "Saving…" : "I'm staying overnight"}
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            {openSince && (
                <Card className="before:bg-amber-500/30 bg-amber-500/10 p-5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-amber-300">
                                Still checked in since {new Date(openSince).toLocaleString()} — forgot to tap out?
                            </p>
                            <button
                                onClick={() => openCorrection("checked_out_at")}
                                className="mt-3 flex items-center gap-1.5 border border-amber-500/40 px-4 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/10 transition"
                            >
                                <LogOut className="h-3.5 w-3.5" /> I left at…
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            {!openSince && !loading && (
                <Card className="p-5">
                    <p className="text-sm text-gray-400">Forgot to check in earlier today?</p>
                    <button
                        onClick={() => openCorrection("checked_in_at")}
                        className="mt-3 flex items-center gap-1.5 border border-white/10 px-4 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/10 transition"
                    >
                        <LogIn className="h-3.5 w-3.5" /> I arrived at…
                    </button>
                </Card>
            )}

            {showCorrection && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={() => setShowCorrection(null)}>
                    <div
                        className="relative isolate w-full max-w-sm bg-black/95 p-5 before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-white/10"
                        style={CARD_CLIP}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="mb-3 text-sm font-bold text-white">
                            {showCorrection === "checked_out_at" ? "What time did you leave?" : "What time did you arrive?"}
                        </h3>
                        <input
                            type="datetime-local"
                            value={correctionTime}
                            onChange={(e) => setCorrectionTime(e.target.value)}
                            className="w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-red/50 focus:outline-none"
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <button onClick={() => setShowCorrection(null)} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition">
                                Cancel
                            </button>
                            <button
                                onClick={submitCorrection}
                                disabled={submittingCorrection}
                                className="bg-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red/80 transition disabled:opacity-50"
                            >
                                {submittingCorrection ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Card className="p-5 sm:p-6">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">Recent sessions</h2>
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-10 animate-pulse bg-white/5" />
                        ))}
                    </div>
                ) : sessions.length === 0 ? (
                    <p className="text-sm text-gray-500">No sessions recorded yet.</p>
                ) : (
                    <div className="space-y-2">
                        {sessions.map((s, i) => (
                            <div key={i} className="flex items-center justify-between border border-white/5 bg-black/20 px-3 py-2.5 text-sm">
                                <span className="text-gray-300">{new Date(s.inAt).toLocaleString()}</span>
                                <span className="font-mono text-xs text-gray-500">{s.outAt ? formatDuration(s.durationMs) : "still in"}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
