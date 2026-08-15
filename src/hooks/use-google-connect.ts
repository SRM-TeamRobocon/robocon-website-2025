"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GoogleConnectResult = {
    success: boolean;
    message: string;
    email: string | null;
};

// Drives the "Connect Gmail" popup (opened against /api/member/auth/google/connect):
// listens for the postMessage the connect callback route sends before it closes itself,
// and reports the outcome back to whichever UI triggered it. Shared by the profile
// page's "Connected accounts" card and the dashboard reminder modal so both stay in
// sync with the same popup-handling logic.
export function useGoogleConnect(onResult: (result: GoogleConnectResult) => void) {
    const [connecting, setConnecting] = useState(false);
    const onResultRef = useRef(onResult);
    onResultRef.current = onResult;

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return;
            if (e.data?.type !== "member-google-connect") return;
            setConnecting(false);
            onResultRef.current({
                success: Boolean(e.data.success),
                message: e.data.message || "",
                email: e.data.email ?? null,
            });
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    const connect = useCallback(() => {
        const popup = window.open("/api/member/auth/google/connect", "connect-google", "width=480,height=640");
        if (!popup) {
            onResultRef.current({ success: false, message: "Popup blocked — allow popups for this site and try again.", email: null });
            return;
        }
        setConnecting(true);
    }, []);

    return { connect, connecting };
}
