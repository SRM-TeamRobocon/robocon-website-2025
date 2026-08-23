"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from "html5-qrcode";
import toast from "react-hot-toast";
import { useRequireRole } from "@/hooks/use-require-role";

const SESSIONS = [
    { key: "day1Morning", label: "Day 1 — Morning" },
    { key: "day1Evening", label: "Day 1 — Evening" },
    { key: "day2Morning", label: "Day 2 — Morning" },
    { key: "day2Evening", label: "Day 2 — Evening" },
    { key: "day3Morning", label: "Day 3 — Morning" },
    { key: "day3Evening", label: "Day 3 — Evening" },
] as const;

type SessionKey = typeof SESSIONS[number]["key"];

function ScannerComponent() {
    const ready = useRequireRole(["lead", "admin"]);
    const searchParams = useSearchParams();
    const initialEvent = searchParams.get("event") || "Solidworks";

    const [eventName, setEventName] = useState(initialEvent);
    const [session, setSession] = useState<SessionKey>("day1Morning");
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
    const [analytics, setAnalytics] = useState({ total: 0, scanned: 0, remaining: 0 });

    // Use refs to avoid stale closures in html5-qrcode callbacks
    const eventNameRef = useRef(eventName);
    const sessionRef = useRef(session);
    const loadingRef = useRef(false);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    const fetchAnalytics = React.useCallback(async (event: string, sess: SessionKey) => {
        try {
            const res = await fetch(`/api/admin/registrations?event=${event}`);
            const json = await res.json();
            if (json.success && json.data) {
                const verified = json.data.filter(
                    (r: any) =>
                        r.paymentStatus === "VERIFIED" &&
                        r.workshop.trim().toLowerCase() === event.trim().toLowerCase()
                );
                const scanned = verified.filter((r: any) => r[sess] === "PRESENT").length;
                setAnalytics({ total: verified.length, scanned, remaining: verified.length - scanned });
            }
        } catch (error) {
            console.error("Failed to fetch analytics", error);
        }
    }, []);

    useEffect(() => {
        eventNameRef.current = eventName;
        sessionRef.current = session;
        fetchAnalytics(eventName, session);
    }, [eventName, session, fetchAnalytics]);

    const handleScan = React.useCallback(async (decodedText: string) => {
        const cleanText = decodedText.trim();
        if (loadingRef.current) return;

        loadingRef.current = true;
        setLoading(true);
        setScanResult(cleanText);
        setMessage({ text: `Verifying ${cleanText}...`, type: "info" });

        // Beep on scan
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                const actx = new AudioContext();
                const osc = actx.createOscillator();
                osc.connect(actx.destination);
                osc.frequency.value = 800;
                osc.start();
                setTimeout(() => osc.stop(), 100);
            }
        } catch (e) { }

        try {
            const toastId = toast.loading(`Verifying ${decodedText}...`);

            const res = await fetch("/api/admin/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticketId: cleanText,
                    eventName: eventNameRef.current,
                    session: sessionRef.current,
                }),
            });

            const json = await res.json();

            if (json.success) {
                setMessage({ text: json.message || "Successfully Checked In!", type: "success" });
                toast.success(json.message || "Successfully Checked In!", { id: toastId, duration: 4000 });
                fetchAnalytics(eventNameRef.current, sessionRef.current);
            } else {
                setMessage({ text: json.error || "Failed to check in", type: "error" });
                toast.error(json.error || "Failed to check in", { id: toastId, duration: 5000 });
            }
        } catch (error) {
            console.error("Scan error:", error);
            setMessage({ text: "Network error while verifying ticket.", type: "error" });
            toast.error("Network error while verifying ticket.");
        } finally {
            setTimeout(() => {
                loadingRef.current = false;
                setLoading(false);
                setScanResult(null);
                setMessage(null);
            }, 3000);
        }
    }, [fetchAnalytics]);

    useEffect(() => {
        // Guard on `ready`: until the role check resolves, the component renders
        // null and the #qr-reader div doesn't exist yet — constructing the scanner
        // before then throws (it looks up the element synchronously).
        if (!ready) return;

        if (!scannerRef.current) {
            scannerRef.current = new Html5QrcodeScanner(
                "qr-reader",
                {
                    fps: 15,
                    qrbox: { width: 250, height: 250 },
                    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
                    // See src/components/recruit/Html5QrcodeScanner.tsx for why each of
                    // these speeds up decoding — same reasoning applies to this scanner.
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                    useBarCodeDetectorIfSupported: true,
                    disableFlip: true,
                    videoConstraints: { facingMode: "environment" },
                },
                false
            );

            scannerRef.current.render(
                (decodedText) => {
                    if (!loadingRef.current) {
                        handleScan(decodedText);
                    }
                },
                () => { }
            );
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e));
                scannerRef.current = null;
            }
        };
    }, [handleScan, ready]);

    const currentSessionLabel = SESSIONS.find(s => s.key === session)?.label ?? session;

    if (!ready) return null;

    return (
        <div className="max-w-3xl mx-auto space-y-8 pt-4 md:pt-8 px-4">
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-6 drop-shadow-md tracking-tight">Registration Scanner</h1>

                {/* Workshop toggle */}
                <div className="inline-flex bg-gray-900/40 p-1.5 rounded-2xl border border-gray-700 backdrop-blur-md mb-4">
                    <button
                        onClick={() => setEventName("Solidworks")}
                        className={`px-8 py-3 rounded-xl text-sm font-black tracking-wide transition-all duration-300 ${eventName === "Solidworks"
                            ? "bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)]"
                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                            }`}
                    >
                        Solidworks
                    </button>
                    <button
                        onClick={() => setEventName("Altium")}
                        className={`px-8 py-3 rounded-xl text-sm font-black tracking-wide transition-all duration-300 ${eventName === "Altium"
                            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                            }`}
                    >
                        Altium
                    </button>
                </div>

                {/* Session dropdown */}
                <div className="flex flex-col items-center gap-2">
                    <p className="text-xs uppercase tracking-widest font-bold text-gray-500">Select Session</p>
                    <div className="relative">
                        <select
                            value={session}
                            onChange={(e) => setSession(e.target.value as SessionKey)}
                            className="appearance-none bg-gray-900/70 border border-gray-600 text-white text-sm font-semibold rounded-xl pl-4 pr-10 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer shadow-inner backdrop-blur-md transition-colors hover:border-gray-500 min-w-[220px]"
                        >
                            {SESSIONS.map((s) => (
                                <option key={s.key} value={s.key} className="bg-gray-900">
                                    {s.label}
                                </option>
                            ))}
                        </select>
                        {/* Chevron icon */}
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    {/* Active session pill */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        Active: {currentSessionLabel}
                    </div>
                </div>
            </div>

            <div className={`bg-gray-900/60 border ${loading ? 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'border-gray-700/50 hover:border-gray-600'} p-4 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden backdrop-blur-xl transition-all duration-300`}>

                {/* Status Overlay */}
                {message && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in zoom-in duration-300" style={{ backgroundColor: 'rgba(3, 7, 18, 0.95)' }}>
                        <div className="text-center max-w-sm w-full bg-gray-900 rounded-3xl p-8 border shadow-2xl relative overflow-hidden" style={{ borderColor: message.type === 'success' ? '#10b981' : message.type === 'error' ? '#ef4444' : '#3b82f6' }}>
                            {message.type === 'success' && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 blur-3xl pointer-events-none" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }} />
                            )}
                            {message.type === 'error' && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 blur-3xl pointer-events-none" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }} />
                            )}

                            <div className="relative z-10">
                                {message.type === 'success' && (
                                    <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center border-4 border-gray-900" style={{ backgroundColor: '#10b981', boxShadow: '0 0 40px rgba(16, 185, 129, 0.5)' }}>
                                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                                {message.type === 'error' && (
                                    <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center border-4 border-gray-900" style={{ backgroundColor: '#ef4444', boxShadow: '0 0 40px rgba(239, 68, 68, 0.5)' }}>
                                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                )}
                                {message.type === 'info' && (
                                    <div className="w-20 h-20 mx-auto mb-6 relative flex items-center justify-center">
                                        <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}></div>
                                        <div className="absolute inset-0 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#3b82f6 transparent transparent transparent' }}></div>
                                    </div>
                                )}

                                <h2 className="text-3xl font-black mb-3" style={{ color: message.type === 'success' ? '#34d399' : message.type === 'error' ? '#ef4444' : '#60a5fa' }}>
                                    {message.type === 'success' ? 'Ticket Valid!' : message.type === 'error' ? 'Invalid Ticket' : 'Verifying...'}
                                </h2>
                                <p className="text-white text-lg font-medium leading-relaxed">{message.text}</p>
                                {/* Show which session was scanned */}
                                <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest">{currentSessionLabel}</p>
                                {scanResult && message.type !== 'info' && (
                                    <div className="mt-6 pt-6 border-t border-gray-800">
                                        <p className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: '#9ca3af' }}>Scanned ID</p>
                                        <p className="text-sm font-mono border border-gray-800 py-2.5 px-4 rounded-xl inline-block shadow-inner" style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#d1d5db' }}>{scanResult}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <style key="qr-styles" dangerouslySetInnerHTML={{
                    __html: `
                    #qr-reader {
                        border: none !important;
                        background: transparent !important;
                    }
                    #qr-reader * {
                        color: #e5e7eb !important;
                        font-family: inherit !important;
                    }
                    #qr-reader button {
                        background: #3b82f6 !important;
                        color: white !important;
                        padding: 10px 20px !important;
                        border-radius: 12px !important;
                        border: none !important;
                        margin: 10px 4px !important;
                        font-weight: 700 !important;
                        cursor: pointer !important;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                        transition: all 0.2s !important;
                    }
                    #qr-reader button:hover {
                        background: #2563eb !important;
                    }
                    #qr-reader select {
                        background: #1f2937 !important;
                        color: white !important;
                        padding: 10px !important;
                        border-radius: 12px !important;
                        border: 1px solid #374151 !important;
                        margin: 10px 4px !important;
                        outline: none !important;
                        cursor: pointer !important;
                    }
                    #qr-reader__dashboard_section_swaplink {
                        color: #60a5fa !important;
                        text-decoration: underline !important;
                        margin-top: 10px !important;
                        display: inline-block !important;
                    }
                `}} />

                {/* Scanner Element */}
                <div id="qr-reader" className="w-full bg-black/50 rounded-2xl overflow-hidden [&_video]:w-full [&_video]:object-cover border border-gray-800/50 shadow-inner min-h-[300px]" />

                {/* Manual Fallback */}
                <div className="mt-8 border-t border-gray-800/80 pt-8">
                    <p className="text-sm font-medium text-gray-400 mb-4 text-center">Camera disabled or restricted? Use manual entry fallback:</p>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const input = e.currentTarget.elements.namedItem('ticketId') as HTMLInputElement;
                            if (input.value) {
                                handleScan(input.value.trim());
                                input.value = '';
                            }
                        }}
                        className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                    >
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                            </div>
                            <input
                                type="text"
                                name="ticketId"
                                placeholder="E.g. ROBO-DA3210-456"
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase font-mono shadow-inner transition-colors"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] active:scale-95 whitespace-nowrap"
                        >
                            Verify
                        </button>
                    </form>
                </div>
            </div>

            <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-gray-700/50 p-5 md:p-6 rounded-2xl flex flex-col sm:flex-row items-start gap-4 md:gap-6 text-sm backdrop-blur-md">
                <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30 flex-shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="text-gray-300">
                    <p className="font-bold text-white text-base mb-2">Scanner Instructions</p>
                    <ul className="space-y-1.5 list-disc list-inside marker:text-blue-500">
                        <li>Select the correct <span className="text-white font-semibold">workshop</span> and <span className="text-white font-semibold">session</span> before scanning.</li>
                        <li>Grant camera permissions if your browser prompts you.</li>
                        <li>Center the attendee&apos;s QR code in the frame with adequate lighting.</li>
                        <li>The system will check them into the selected session column in Google Sheets.</li>
                    </ul>
                </div>
            </div>

            {/* Live Analytics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6 mt-8 pb-20">
                <div className="bg-gray-900/80 border border-gray-800 p-4 md:p-6 rounded-2xl shadow-xl backdrop-blur-md">
                    <p className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Total {eventName}</p>
                    <p className="text-2xl md:text-4xl font-black text-white">{analytics.total}</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 md:p-6 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.1)] backdrop-blur-md relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/20 rounded-full blur-xl"></div>
                    <p className="text-xs md:text-sm font-bold text-emerald-500 uppercase tracking-widest mb-1 relative z-10">Checked In</p>
                    <p className="text-2xl md:text-4xl font-black text-emerald-400 relative z-10">{analytics.scanned}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1 relative z-10 truncate">{currentSessionLabel}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 md:p-6 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.1)] backdrop-blur-md relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/20 rounded-full blur-xl"></div>
                    <p className="text-xs md:text-sm font-bold text-amber-500 uppercase tracking-widest mb-1 relative z-10">Remaining</p>
                    <p className="text-2xl md:text-4xl font-black text-amber-400 relative z-10">{analytics.remaining}</p>
                    <p className="text-[10px] text-amber-600 font-semibold mt-1 relative z-10 truncate">{currentSessionLabel}</p>
                </div>
            </div>
        </div>
    );
}

export default function ScannerPage() {
    return (
        <Suspense fallback={
            <div className="min-h-[400px] flex flex-col items-center justify-center text-white gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="font-bold text-gray-400">Loading Scanner...</p>
            </div>
        }>
            <ScannerComponent />
        </Suspense>
    );
}
