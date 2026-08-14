"use client";

import { useEffect, useRef } from "react";
import {
    Html5QrcodeScanner as Html5QrcodeScannerLib,
    Html5QrcodeScanType,
    Html5QrcodeSupportedFormats,
} from "html5-qrcode";

interface Html5QrcodeScannerProps {
    /** Called on every successful decode. Fires once per frame that decodes cleanly —
     *  callers are responsible for debouncing/ignoring repeats while a scan is in flight. */
    onScan: (decodedText: string) => void;
    /** DOM id for the reader container. Only needs to change if multiple instances mount at once. */
    elementId?: string;
}

// Thin client-only wrapper around html5-qrcode's built-in scanner UI. Mirrors the camera
// lifecycle used by src/app/scanner/page.tsx (refs to dodge stale closures inside the
// library's callbacks, render/clear on mount/unmount) without any of that page's
// workshop/Sheets-specific business logic — this component only ever reports decoded text.
export default function Html5QrcodeScanner({ onScan, elementId = "recruit-qr-reader" }: Html5QrcodeScannerProps) {
    // Keep the latest onScan in a ref so the html5-qrcode success callback (registered once,
    // on mount) always calls the current handler rather than whatever was passed in on first render.
    const onScanRef = useRef(onScan);
    const scannerRef = useRef<Html5QrcodeScannerLib | null>(null);

    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    useEffect(() => {
        if (scannerRef.current) return;

        const scanner = new Html5QrcodeScannerLib(
            elementId,
            {
                fps: 15,
                qrbox: { width: 250, height: 250 },
                supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
                // Recruit QR payloads are always our own QR codes — restricting the decoder
                // to this one format (instead of the library's default of trying every
                // barcode format on every frame) cuts real per-frame decode work.
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                // Uses the browser's native, hardware-accelerated BarcodeDetector API when
                // available (Chrome/Android) instead of the much slower pure-JS decoder —
                // library falls back automatically where unsupported (e.g. Safari/iOS).
                useBarCodeDetectorIfSupported: true,
                // Skips the mirror-flip decode pass — irrelevant for a rear camera, which
                // this is (videoConstraints below) for every real scanning device.
                disableFlip: true,
                videoConstraints: { facingMode: "environment" },
            },
            /* verbose */ false
        );
        scannerRef.current = scanner;

        // Requests camera permission and starts continuous scanning.
        scanner.render(
            (decodedText) => {
                onScanRef.current(decodedText);
            },
            () => {
                // Per-frame decode failures are normal noise (no QR in view, blur, etc.) —
                // silently ignore rather than surfacing an error for every failed frame.
            }
        );

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(() => {
                    // Scanner may already be stopped/torn down — ignore cleanup errors.
                });
                scannerRef.current = null;
            }
        };
        // Intentionally only re-run if the container id changes — onScan updates flow through the ref.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [elementId]);

    return <div id={elementId} className="w-full [&_video]:w-full [&_video]:object-cover [&_video]:rounded-xl" />;
}
