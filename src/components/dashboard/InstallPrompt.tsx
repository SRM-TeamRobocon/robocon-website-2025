"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

// Once per browser session, same pattern as GoogleConnectReminder - dismissing
// shouldn't permanently hide it, but it also shouldn't nag on every navigation.
const DISMISS_KEY = "dashboard_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isIos() {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) return true;
    // iPadOS 13+ identifies as "MacIntel" but exposes multi-touch, unlike a real Mac.
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isStandalone() {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
}

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showIos, setShowIos] = useState(false);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        if (isStandalone()) return;
        if (window.sessionStorage.getItem(DISMISS_KEY)) return;

        navigator.serviceWorker
            ?.register("/dashboard-sw.js", { scope: "/dashboard/" })
            .catch(() => {});

        // iOS Safari has no beforeinstallprompt API - only a manual Share menu path.
        if (isIos()) {
            const timer = setTimeout(() => setShowIos(true), 2000);
            return () => clearTimeout(timer);
        }

        const handlePrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        const handleInstalled = () => {
            setDeferredPrompt(null);
            window.sessionStorage.setItem(DISMISS_KEY, "1");
        };

        window.addEventListener("beforeinstallprompt", handlePrompt);
        window.addEventListener("appinstalled", handleInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", handlePrompt);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, []);

    const dismiss = () => {
        window.sessionStorage.setItem(DISMISS_KEY, "1");
        setDeferredPrompt(null);
        setShowIos(false);
    };

    const install = async () => {
        if (!deferredPrompt) return;
        setInstalling(true);
        try {
            await deferredPrompt.prompt();
            await deferredPrompt.userChoice;
        } finally {
            setInstalling(false);
            setDeferredPrompt(null);
            window.sessionStorage.setItem(DISMISS_KEY, "1");
        }
    };

    if (!deferredPrompt && !showIos) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto z-[90] sm:w-80">
            <div
                className="bg-white/10 p-px shadow-2xl"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 94% 100%, 0 100%)" }}
            >
                <div
                    className="bg-gray-900 p-4"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 94% 100%, 0 100%)" }}
                >
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Download className="w-4 h-4 text-red" />
                            Install Dashboard
                        </div>
                        <button onClick={dismiss} aria-label="Dismiss" className="text-gray-500 hover:text-white transition">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {showIos ? (
                        <p className="mb-3 text-xs text-gray-400">
                            Tap <Share className="inline w-3 h-3 mx-0.5 -mt-0.5" /> Share, then &quot;Add to Home Screen&quot;
                            to install this dashboard as an app.
                        </p>
                    ) : (
                        <p className="mb-3 text-xs text-gray-400">
                            Install the dashboard for quick access from your home screen or desktop, with its own app window.
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-4">
                        <button onClick={dismiss} className="text-xs text-gray-400 hover:text-white transition">
                            Maybe later
                        </button>
                        {!showIos && (
                            <button
                                onClick={install}
                                disabled={installing}
                                className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-xs font-semibold text-white hover:from-blue-500 hover:to-blue-400 transition disabled:opacity-50"
                                style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                            >
                                {installing ? "Installing…" : "Install"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
