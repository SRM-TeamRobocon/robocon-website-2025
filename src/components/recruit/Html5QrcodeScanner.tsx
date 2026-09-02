"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ScanLine, Camera, RotateCcw } from "lucide-react";

interface Html5QrcodeScannerProps {
    /** Called on every successful decode. Fires once per frame that decodes cleanly -
     *  callers are responsible for debouncing/ignoring repeats while a scan is in flight. */
    onScan: (decodedText: string) => void;
    /** DOM id for the reader container. Only needs to change if multiple instances mount at once. */
    elementId?: string;
}

type Status = "starting" | "running" | "error";

// Client-only wrapper around html5-qrcode's bare Html5Qrcode class (not the library's
// Html5QrcodeScanner) - that full-UI class injects its own camera-select/start-stop
// controls, which render as unstyled default browser chrome that clashes badly with this
// page's dark theme (overlapping text, plain white brackets on a raw video feed). Using
// the bare class means zero library-injected DOM: every control and the whole HUD overlay
// below is ours, and `onScan`'s contract is unchanged so nothing calling this component
// needs to change.
export default function Html5QrcodeScanner({ onScan, elementId = "recruit-qr-reader" }: Html5QrcodeScannerProps) {
    const onScanRef = useRef(onScan);
    const instanceRef = useRef<Html5Qrcode | null>(null);
    const isRunningRef = useRef(false);

    const [status, setStatus] = useState<Status>("starting");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
    const [showCameraMenu, setShowCameraMenu] = useState(false);

    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    const startWith = useCallback(async (cameraIdOrConfig: string | { facingMode: string }) => {
        const instance = instanceRef.current;
        if (!instance) return;
        setStatus("starting");
        setErrorMessage(null);
        try {
            if (isRunningRef.current) {
                await instance.stop();
                isRunningRef.current = false;
            }
            await instance.start(
                cameraIdOrConfig,
                { fps: 15, qrbox: { width: 250, height: 250 }, disableFlip: true },
                (decodedText) => onScanRef.current(decodedText),
                () => {
                    // Per-frame decode failures are normal noise (no QR in view, blur, etc.).
                }
            );
            isRunningRef.current = true;
            setStatus("running");
        } catch (err) {
            isRunningRef.current = false;
            setStatus("error");
            setErrorMessage(err instanceof Error ? err.message : "Could not start the camera.");
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const instance = new Html5Qrcode(elementId, {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            useBarCodeDetectorIfSupported: true,
            verbose: false,
        });
        instanceRef.current = instance;

        (async () => {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (cancelled) return;
                setCameras(devices.map((d) => ({ id: d.id, label: d.label })));
            } catch {
                // Permission denied or nothing enumerable - the facingMode start below has
                // its own permission prompt and will surface a clear error if that fails too.
            }
            if (cancelled) return;
            await startWith({ facingMode: "environment" });
        })();

        return () => {
            cancelled = true;
            const inst = instanceRef.current;
            instanceRef.current = null;
            if (!inst) return;
            const wasRunning = isRunningRef.current;
            isRunningRef.current = false;
            // Routing even the initial call through .then() means a synchronous throw from
            // .stop() (some builds don't reliably return a rejected promise) still lands in
            // .catch() instead of crashing the unmount - this cleanup must never throw.
            Promise.resolve()
                .then(() => (wasRunning ? inst.stop() : undefined))
                .catch(() => {})
                .finally(() => {
                    try {
                        inst.clear();
                    } catch {
                        // Element may already be torn down - ignore cleanup errors.
                    }
                });
        };
        // Intentionally only re-run if the container id changes - onScan updates flow through the ref.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [elementId]);

    const switchCamera = (id: string) => {
        setActiveCameraId(id);
        setShowCameraMenu(false);
        startWith(id);
    };

    return (
        <div className="hud-scanner relative w-full overflow-hidden rounded-xl border border-white/10 bg-black">
            <div
                id={elementId}
                className="w-full [&_video]:w-full [&_video]:object-cover [&_video]:block"
            />

            {/* Static overlay - plain frame + status text, no motion. */}
            <div className="pointer-events-none absolute inset-0">
                <div className="hud-corner hud-corner-tl" />
                <div className="hud-corner hud-corner-tr" />
                <div className="hud-corner hud-corner-bl" />
                <div className="hud-corner hud-corner-br" />

                <div className="absolute left-3 top-3 flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-red">
                    <span className="hud-dot" />
                    LIVE
                </div>
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-white/50">
                    <ScanLine className="h-3 w-3" strokeWidth={2.5} />
                    {status === "running" ? "AWAITING QR" : status === "starting" ? "SYNCING" : "OFFLINE"}
                </div>
            </div>

            {cameras.length > 1 && (
                <div className="pointer-events-auto absolute right-3 top-3">
                    <button
                        type="button"
                        onClick={() => setShowCameraMenu((v) => !v)}
                        className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70 transition-colors hover:border-red/50 hover:text-white"
                    >
                        <Camera className="h-3 w-3" strokeWidth={2.5} />
                        Camera
                    </button>
                    {showCameraMenu && (
                        <div className="absolute right-0 mt-1.5 w-48 overflow-hidden rounded-lg border border-white/15 bg-black">
                            {cameras.map((cam, i) => (
                                <button
                                    key={cam.id}
                                    type="button"
                                    onClick={() => switchCamera(cam.id)}
                                    className={`block w-full truncate px-3 py-2 text-left text-xs transition-colors ${
                                        activeCameraId === cam.id
                                            ? "bg-red/20 text-red"
                                            : "text-white/70 hover:bg-white/10 hover:text-white"
                                    }`}
                                >
                                    {cam.label || `Camera ${i + 1}`}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {status !== "running" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
                    {status === "starting" ? (
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="hud-spinner" />
                            <p className="font-mono text-xs font-bold uppercase tracking-widest text-white/60">
                                Initializing camera...
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 px-6 text-center">
                            <p className="font-mono text-xs font-bold uppercase tracking-widest text-red">Camera unavailable</p>
                            <p className="max-w-xs text-xs text-white/50">{errorMessage}</p>
                            <button
                                type="button"
                                onClick={() => startWith(activeCameraId ?? { facingMode: "environment" })}
                                className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white/80 hover:border-white/40 hover:text-white transition-colors"
                            >
                                <RotateCcw className="h-3 w-3" strokeWidth={2.5} />
                                Retry
                            </button>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .hud-scanner {
                    aspect-ratio: 3 / 4;
                }

                .hud-corner {
                    position: absolute;
                    width: 22px;
                    height: 22px;
                    border: 2px solid rgba(194, 0, 0, 0.85);
                }
                .hud-corner-tl {
                    top: 10px;
                    left: 10px;
                    border-right: none;
                    border-bottom: none;
                    border-top-left-radius: 4px;
                }
                .hud-corner-tr {
                    top: 10px;
                    right: 10px;
                    border-left: none;
                    border-bottom: none;
                    border-top-right-radius: 4px;
                }
                .hud-corner-bl {
                    bottom: 10px;
                    left: 10px;
                    border-right: none;
                    border-top: none;
                    border-bottom-left-radius: 4px;
                }
                .hud-corner-br {
                    bottom: 10px;
                    right: 10px;
                    border-left: none;
                    border-top: none;
                    border-bottom-right-radius: 4px;
                }

                .hud-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 9999px;
                    background: #ef4444;
                }

                .hud-spinner {
                    width: 34px;
                    height: 34px;
                    border-radius: 9999px;
                    border: 2px solid rgba(255, 255, 255, 0.15);
                    border-top-color: #c20000;
                    animation: hud-spin 0.8s linear infinite;
                }
                @keyframes hud-spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </div>
    );
}
