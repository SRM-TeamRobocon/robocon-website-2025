"use client";

import { useEffect, useState } from "react";
import { Bell, Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

// Once per browser session, same pattern as GoogleConnectReminder - dismissing
// shouldn't permanently hide it, but it also shouldn't nag on every navigation.
const DISMISS_KEY = "dashboard_install_dismissed";
const NOTIFICATIONS_DISMISSED_KEY = "member_notifications_prompt_dismissed";

function decodeVapidKey(value: string) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

export default function InstallPrompt({ showNotifications = false }: { showNotifications?: boolean }) {
    const { canInstall, isIos, installed, promptInstall } = useInstallPrompt();
    const [dismissed, setDismissed] = useState(true);
    const [showIos, setShowIos] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [showNotificationOption, setShowNotificationOption] = useState(false);
    const [enablingNotifications, setEnablingNotifications] = useState(false);
    const [notificationError, setNotificationError] = useState<string | null>(null);

    useEffect(() => {
        setDismissed(!!window.sessionStorage.getItem(DISMISS_KEY));
    }, []);

    useEffect(() => {
        if (!showNotifications || !("Notification" in window)) return;
        if (Notification.permission === "denied") return;

        let cancelled = false;
        const checkSubscription = async () => {
            if (Notification.permission === "default") {
                if (window.localStorage.getItem(NOTIFICATIONS_DISMISSED_KEY) !== "1" && !cancelled) {
                    setShowNotificationOption(true);
                }
                return;
            }

            if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (cancelled) return;
                if (subscription) {
                    const response = await fetch("/api/member/notifications", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(subscription.toJSON()),
                    });
                    if (!response.ok && !cancelled) {
                        setNotificationError("Could not connect this device to attendance alerts.");
                        setShowNotificationOption(true);
                    }
                } else {
                    setShowNotificationOption(true);
                }
            } catch {
                if (!cancelled) setShowNotificationOption(true);
            }
        };

        void checkSubscription();
        return () => {
            cancelled = true;
        };
    }, [showNotifications]);

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

    const showInstallOption = !installed && !dismissed && (canInstall || showIos);

    const dismissNotifications = () => {
        window.localStorage.setItem(NOTIFICATIONS_DISMISSED_KEY, "1");
        setShowNotificationOption(false);
    };

    const enableNotifications = async () => {
        setEnablingNotifications(true);
        setNotificationError(null);
        try {
            if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
                throw new Error(
                    isIos && !installed
                        ? "On iPhone, add STR Hub to your Home Screen before enabling push notifications."
                        : "This browser does not support push notifications."
                );
            }

            const permission = Notification.permission === "default"
                ? await Notification.requestPermission()
                : Notification.permission;
            if (permission !== "granted") throw new Error("Allow notifications in your browser settings to get your tap alerts.");

            const configResponse = await fetch("/api/member/notifications");
            const config = await configResponse.json();
            if (!configResponse.ok || !config.success || !config.publicKey) {
                throw new Error(config.error || "Push notifications are not configured yet.");
            }

            const registration = await navigator.serviceWorker.register("/dashboard-sw.js", { scope: "/dashboard/" });
            await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: decodeVapidKey(config.publicKey),
                });
            }

            const saveResponse = await fetch("/api/member/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(subscription.toJSON()),
            });
            const saved = await saveResponse.json();
            if (!saveResponse.ok || !saved.success) throw new Error(saved.error || "Could not save this device for notifications.");

            setShowNotificationOption(false);
            window.localStorage.removeItem(NOTIFICATIONS_DISMISSED_KEY);
        } catch (error) {
            setNotificationError(error instanceof Error ? error.message : "Could not enable notifications.");
        } finally {
            setEnablingNotifications(false);
        }
    };

    if (!showInstallOption && !showNotificationOption) return null;

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
                    {showInstallOption && (
                        <>
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <Download className="w-4 h-4 text-red" />
                                    Install STR Hub
                                </div>
                                <button onClick={dismiss} aria-label="Dismiss install prompt" className="text-gray-500 hover:text-white transition">
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
                        </>
                    )}

                    {showNotificationOption && (
                        <div className={`${showInstallOption ? "mt-4 border-t border-white/10 pt-4" : ""} flex items-center gap-3`}>
                            <Bell className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white">Lab notifications</p>
                                <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                                    Get a random lab vibe when you tap in or out. Only your devices get it.
                                </p>
                                {notificationError && <p className="mt-1 text-[11px] leading-relaxed text-red-300">{notificationError}</p>}
                            </div>
                            <button
                                type="button"
                                onClick={enableNotifications}
                                disabled={enablingNotifications}
                                className="shrink-0 bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-50"
                            >
                                {enablingNotifications ? "Enabling…" : "Enable"}
                            </button>
                            <button
                                type="button"
                                onClick={dismissNotifications}
                                aria-label="Dismiss notification option"
                                className="shrink-0 text-gray-500 transition hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
