"use client";

import { useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function isIosDevice() {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) return true;
    // iPadOS 13+ identifies as "MacIntel" but exposes multi-touch, unlike a real Mac.
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isStandaloneDisplay() {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
}

// Shared by the auto-popup banner and the sidebar "Install app" button - both attach
// their own beforeinstallprompt listener (the browser happily fires it to every
// listener), so neither has to own the single captured event on the other's behalf.
export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        if (isStandaloneDisplay()) {
            setInstalled(true);
            return;
        }

        navigator.serviceWorker
            ?.register("/dashboard-sw.js", { scope: "/dashboard/" })
            .catch(() => {});

        const handlePrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        const handleInstalled = () => {
            setInstalled(true);
            setDeferredPrompt(null);
        };

        window.addEventListener("beforeinstallprompt", handlePrompt);
        window.addEventListener("appinstalled", handleInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", handlePrompt);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, []);

    const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
        if (!deferredPrompt) return "unavailable";
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        return outcome;
    };

    return {
        canInstall: !!deferredPrompt,
        isIos: isIosDevice(),
        installed,
        promptInstall,
    };
}
