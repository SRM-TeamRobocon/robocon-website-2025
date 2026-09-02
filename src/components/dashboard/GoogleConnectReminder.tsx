"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Mail, X } from "lucide-react";
import { useGoogleConnect } from "@/hooks/use-google-connect";

// Only nag once per browser session - reopening the dashboard tomorrow shouldn't
// re-show this the moment someone dismissed it today.
const DISMISS_KEY = "google_connect_reminder_dismissed";

export default function GoogleConnectReminder() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (window.sessionStorage.getItem(DISMISS_KEY)) return;
        fetch("/api/member/google-status")
            .then(async (res) => {
                if (!res.ok) return; // legacy env-based staff (no member_accounts row) - nothing to connect
                const data = await res.json();
                if (data.success && !data.connected) setVisible(true);
            })
            .catch(() => {});
    }, []);

    const { connect, connecting } = useGoogleConnect((result) => {
        if (result.success) {
            toast.success(result.message || "Google account connected");
            setVisible(false);
        } else {
            toast.error(result.message || "Could not connect Google account");
        }
    });

    const dismiss = () => {
        window.sessionStorage.setItem(DISMISS_KEY, "1");
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
                className="w-full max-w-sm bg-white/10 p-px shadow-2xl"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
            >
                <div
                    className="h-full w-full bg-gray-900 p-6"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Mail className="w-4 h-4 text-red" />
                        Connect your Gmail
                    </div>
                    <button onClick={dismiss} aria-label="Dismiss" className="text-gray-500 hover:text-white transition">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <p className="mb-6 text-sm text-gray-400">
                    Link your Google account so you can sign in with one click next time - no password needed.
                </p>
                <div className="flex items-center justify-end gap-4">
                    <button onClick={dismiss} className="text-xs text-gray-400 hover:text-white transition">
                        Maybe later
                    </button>
                    <button
                        onClick={connect}
                        disabled={connecting}
                        className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-xs font-semibold text-white hover:from-blue-500 hover:to-blue-400 transition disabled:opacity-50"
                        style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                    >
                        {connecting ? "Connecting…" : "Connect Gmail"}
                    </button>
                </div>
            </div>
            </div>
        </div>
    );
}
