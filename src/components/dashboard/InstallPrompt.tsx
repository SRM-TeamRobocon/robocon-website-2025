"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

// Once per browser session, same pattern as GoogleConnectReminder - dismissing
// shouldn't permanently hide it, but it also shouldn't nag on every navigation.
const DISMISS_KEY = "dashboard_install_dismissed";

export default function InstallPrompt() {
    const { canInstall, isIos, installed, promptInstall } = useInstallPrompt();
    const [dismissed, setDismissed] = useState(true);
    const [showIos, setShowIos] = useState(false);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        setDismissed(!!window.sessionStorage.getItem(DISMISS_KEY));
    }, []);

    useEffect(() => {
        // iOS Safari has no beforeinstallprompt API - only a manual Share menu path.
        if (isIos) {
            const timer = setTimeout(() => setShowIos(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [isIos]);

    const dismiss = () => {
        window.sessionStorage.setItem(DISMISS_KEY, "1");
        setDismissed(true);
    };

    const install = async () => {
        setInstalling(true);
        try {
            await promptInstall();
        } finally {
            setInstalling(false);
            dismiss();
        }
    };

    if (installed || dismissed) return null;
    if (!canInstall && !showIos) return null;

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
                            Install STR Hub
                        </div>
                        <button onClick={dismiss} aria-label="Dismiss" className="text-gray-500 hover:text-white transition">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {showIos && !canInstall ? (
                        <p className="mb-3 text-xs text-gray-400">
                            Tap <Share className="inline w-3 h-3 mx-0.5 -mt-0.5" /> Share, then &quot;Add to Home Screen&quot;
                            to install STR Hub as an app.
                        </p>
                    ) : (
                        <p className="mb-3 text-xs text-gray-400">
                            Install STR Hub for quick access from your home screen or desktop, with its own app window.
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-4">
                        <button onClick={dismiss} className="text-xs text-gray-400 hover:text-white transition">
                            Maybe later
                        </button>
                        {canInstall && (
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
