"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserCircle, ArrowRight, X } from "lucide-react";

const STORAGE_KEY_NEVER = "profile_socials_reminder_never";
const STORAGE_KEY_SESSION = "profile_socials_reminder_dismissed";

interface MissingDetails {
    photo: boolean;
    socials: string[];
}

export default function ProfileSocialReminder() {
    const pathname = usePathname();
    const router = useRouter();
    const [, startTransition] = useTransition();

    const [visible, setVisible] = useState(false);
    const [missingDetails, setMissingDetails] = useState<MissingDetails>({ photo: false, socials: [] });
    const [dontAskAgain, setDontAskAgain] = useState(false);
    const [accountKey, setAccountKey] = useState<string | null>(null);

    const evaluateProfile = (profile: {
        photo_url?: string | null;
        linkedin_url?: string | null;
        instagram_url?: string | null;
        facebook_url?: string | null;
    }): MissingDetails => {
        const photo = !profile.photo_url || !String(profile.photo_url).trim();
        const socials: string[] = [];
        if (!profile.linkedin_url || !String(profile.linkedin_url).trim()) socials.push("LinkedIn");
        if (!profile.instagram_url || !String(profile.instagram_url).trim()) socials.push("Instagram");
        if (!profile.facebook_url || !String(profile.facebook_url).trim()) socials.push("Facebook");
        return { photo, socials };
    };

    const checkStatus = async () => {
        try {
            if (typeof window !== "undefined") {
                if (window.localStorage.getItem(STORAGE_KEY_NEVER) === "1") return;
                if (window.sessionStorage.getItem(STORAGE_KEY_SESSION) === "1") return;
            }

            const res = await fetch("/api/profile");
            if (res.status === 401 || res.status === 403) {
                // Not logged in or not a team member
                setVisible(false);
                return;
            }

            if (res.status === 404) {
                // Member account exists but profile hasn't been set up in roster yet
                setMissingDetails({ photo: true, socials: ["LinkedIn", "Instagram", "Facebook"] });
                setVisible(true);
                return;
            }

            const json = await res.json();
            if (json.success && json.claimed && json.data) {
                if (json.data.id) {
                    setAccountKey(json.data.id);
                    if (window.localStorage.getItem(`${STORAGE_KEY_NEVER}_${json.data.id}`) === "1") {
                        setVisible(false);
                        return;
                    }
                }

                const missing = evaluateProfile(json.data);
                if (missing.photo || missing.socials.length > 0) {
                    setMissingDetails(missing);
                    setVisible(true);
                } else {
                    setVisible(false);
                }
            } else if (json.success && !json.claimed) {
                setMissingDetails({ photo: true, socials: ["LinkedIn", "Instagram", "Facebook"] });
                setVisible(true);
            } else {
                setVisible(false);
            }
        } catch {
            setVisible(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    // Listen for live updates when the user saves their profile
    useEffect(() => {
        const handleProfileUpdated = (event: Event) => {
            const customEvent = event as CustomEvent;
            const updated = customEvent.detail;
            if (updated) {
                const missing = evaluateProfile(updated);
                if (!missing.photo && missing.socials.length === 0) {
                    setVisible(false);
                } else {
                    setMissingDetails(missing);
                }
            }
        };

        window.addEventListener("profile-updated", handleProfileUpdated);
        return () => window.removeEventListener("profile-updated", handleProfileUpdated);
    }, []);

    const handleDoNow = () => {
        const targetHash = missingDetails.photo ? "#photo" : "#socials";
        startTransition(() => {
            router.push(`/dashboard/profile${targetHash}`);
        });
    };

    const handleLater = () => {
        if (dontAskAgain) {
            window.localStorage.setItem(STORAGE_KEY_NEVER, "1");
            if (accountKey) {
                window.localStorage.setItem(`${STORAGE_KEY_NEVER}_${accountKey}`, "1");
            }
        } else {
            window.sessionStorage.setItem(STORAGE_KEY_SESSION, "1");
        }
        setVisible(false);
    };

    // Only show inside dashboard, and hide when already on the profile page
    if (!visible) return null;
    if (!pathname.startsWith("/dashboard") || pathname === "/dashboard/profile") {
        return null;
    }

    const { photo, socials } = missingDetails;
    const socialsText =
        socials.length === 3
            ? "social media handles (LinkedIn, Instagram, Facebook)"
            : `social links (${socials.join(", ")})`;

    let message = "";
    if (photo && socials.length > 0) {
        message = `You haven't added your profile photo and ${socialsText} to your profile.`;
    } else if (photo) {
        message = "You haven't added a profile photo to your profile.";
    } else {
        message = `You haven't added your ${socialsText} to your profile.`;
    }

    return (
        <aside
            aria-label="Profile completion reminder"
            className="w-full bg-gradient-to-r from-red/20 via-[#16171b] to-[#101114] border-b border-red/40 text-white shadow-md transition-all"
        >
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red"></span>
                    </span>
                    <UserCircle className="w-4 h-4 text-red shrink-0" />
                    <span className="text-gray-200">
                        <strong className="text-white font-semibold">Reminder:</strong> {message}
                    </span>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 self-end sm:self-auto">
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={dontAskAgain}
                            onChange={(e) => setDontAskAgain(e.target.checked)}
                            className="rounded bg-black/60 border-white/30 text-red focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                        />
                        <span className="whitespace-nowrap">Don&apos;t ask again</span>
                    </label>

                    <button
                        onClick={handleLater}
                        type="button"
                        className="px-2.5 py-1 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 transition whitespace-nowrap"
                    >
                        Will do later
                    </button>

                    <button
                        onClick={handleDoNow}
                        type="button"
                        className="px-3 py-1 text-xs font-bold text-white bg-red hover:bg-red-700 transition uppercase tracking-wider flex items-center gap-1 whitespace-nowrap shadow-sm"
                    >
                        <span>Do it now</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                        onClick={handleLater}
                        type="button"
                        aria-label="Dismiss notification"
                        className="text-gray-400 hover:text-white p-1 transition shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
