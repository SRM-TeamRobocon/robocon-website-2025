"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import { generateBadgeImage } from "@/components/recruit/generateBadgeImage";
import AuthNav from "@/components/AuthNav";
import EmailVerifyBanner from "@/components/recruit/EmailVerifyBanner";
import FaqSection from "@/components/recruit/FaqSection";
import TicketsSection from "@/components/recruit/TicketsSection";
import ChatWidget from "@/components/recruit/ChatWidget";
import { travelMethodLabel } from "@/lib/travel-method";
import { genderLabel } from "@/lib/gender";

const LanyardBadge = dynamic(() => import("@/components/recruit/LanyardBadge"), { ssr: false });

// Sharp red/white/black poster theme — matches RecruitmentSection (homepage teaser) and
// the reskinned /recruit/register + /recruit/login. Same clip-path used by CardShell on
// those pages, reused here so every card on the dashboard reads as part of one family.
const CARD_CLIP = "polygon(0 0,100% 0,100% 97%,97% 100%,0 100%)";
const LOGOUT_CLIP = "polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)";
// A `border` doesn't render along a clip-path's angled edges, so these cards/buttons are
// two nested elements instead: an outer one filled with the border color and padded by
// the border width, and an inner one with the real fill — see CARD_OUTER/CARD_INNER below.
const CARD_OUTER = "bg-black p-[2px]";
const CARD_INNER = "h-full w-full bg-white p-6 md:p-8";

type DomainStatus = { sub_domain: string; status: string };

type RecruitProfile = {
    name: string;
    srm_email: string;
    srm_email_verified: boolean;
    reg_no: string;
    year: string;
    gender?: string | null;
    department: string;
    course: string;
    phone?: string | null;
    is_hosteller?: boolean;
    hostel_block?: string | null;
    hostel_room?: string | null;
    portfolio_url?: string | null;
    is_selected: boolean;
};

type TrainingInfo = {
    started: boolean;
    attended: number;
    total: number;
    percentage: number | null;
};

type InterviewInfo = {
    panel_label: string;
    token_number: number;
    status: "waiting" | "called" | "deferred";
    waiting_ahead: number;
};

import { subDomainLabel, subDomainSubsystem } from "@/lib/recruit-domains";

// Hidden for now — flip back on when attendance is ready to be shown to recruits.
const SHOW_TRAINING_ATTENDANCE = false;

// Recolored for the sharp white-card theme: these badges now sit on a solid white
// surface, so they need the darker/saturated weights a light surface calls for
// (tinted bg + solid border + dark-enough text for contrast) instead of the
// dark-glass-tuned `text-*-300 border-*-500/40 bg-*-500/10` pattern. Same semantic
// distinctions as before, just recolored — POWER ON/DEPLOYED/etc. below unchanged.
function statusBadgeClass(label: string): string {
    if (label.startsWith("RUNTIME")) return "text-[#D4AF37] border-[#D4AF37] bg-[#D4AF37]/10";
    switch (label) {
        case "POWER ON":
            return "text-black/50 border-black/20 bg-black/5";
        case "SYSTEM CHECK: PASS":
            return "text-blue-700 border-blue-600 bg-blue-50";
        case "DIAGNOSTIC RUNNING":
            return "text-amber-700 border-amber-600 bg-amber-50 animate-pulse";
        case "DIAGNOSTIC: PASS":
            return "text-emerald-700 border-emerald-600 bg-emerald-50";
        case "DIAGNOSTIC: FAIL":
            return "text-red border-red bg-red/10";
        case "CALIBRATION":
            return "text-purple-700 border-purple-600 bg-purple-50";
        case "DEPLOYED":
            return "text-white border-emerald-600 bg-emerald-600";
        default:
            return "text-black/50 border-black/20 bg-black/5";
    }
}

export default function RecruitDashboardPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<RecruitProfile | null>(null);
    const [domains, setDomains] = useState<DomainStatus[]>([]);
    const [training, setTraining] = useState<TrainingInfo | null>(null);
    const [interview, setInterview] = useState<InterviewInfo | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [badgeImage, setBadgeImage] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const [meRes, qrRes] = await Promise.all([fetch("/api/recruit/me"), fetch("/api/recruit/qr")]);
                const meJson = await meRes.json();
                const qrJson = await qrRes.json();

                if (cancelled) return;

                if (!meRes.ok || !meJson.success) {
                    if (meRes.status === 401) {
                        router.replace("/recruit/login");
                        return;
                    }
                    setError(meJson.error || "Failed to load your status.");
                } else {
                    setProfile(meJson.recruit);
                    setDomains(meJson.domains ?? []);
                    setTraining(meJson.training ?? null);
                    setInterview(meJson.interview ?? null);
                }

                if (qrRes.ok && qrJson.success) {
                    setQrDataUrl(qrJson.qr_data_url);
                }
            } catch {
                if (!cancelled) setError("Network error while loading your status.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // Compose the ID-badge image (logo + name + QR) for the Lanyard's card face once
    // both the profile and QR code are loaded.
    useEffect(() => {
        if (!profile || !qrDataUrl) return;
        let cancelled = false;
        generateBadgeImage({
            name: profile.name,
            regNo: profile.reg_no,
            qrDataUrl,
            logoSrc: "/LOGO.png",
        })
            .then((dataUrl) => {
                if (!cancelled) setBadgeImage(dataUrl);
            })
            .catch(() => {
                // Non-essential — the plain QR image below still works fine without the badge.
            });
        return () => {
            cancelled = true;
        };
    }, [profile, qrDataUrl]);

    // Live queue position polling. Only runs while the recruit currently has an active
    // (waiting/called) interview token — once a poll comes back with `interview: null`
    // (resolved to done/no_show, or never had one), this effect's dependency drops out and
    // the interval is cleared, so it's naturally self-limiting rather than polling forever.
    const isInterviewActive = interview?.status === "waiting" || interview?.status === "called";
    useEffect(() => {
        if (!isInterviewActive) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch("/api/recruit/me");
                const json = await res.json();
                if (res.ok && json.success) {
                    setInterview(json.interview ?? null);
                }
            } catch {
                // Transient network error — just wait for the next tick.
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [isInterviewActive]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
                <div className="w-12 h-12 border-4 border-black/10 border-t-red rounded-full animate-spin" />
                <p className="font-mono text-sm text-black/50 tracking-widest">BOOTING...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white px-4 py-8 md:py-12">
            <div className="max-w-3xl mx-auto">
                <AuthNav variant="sharp" />
            </div>
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-mono text-xs uppercase tracking-widest text-red font-bold">Recruit Terminal</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-black">Status Dashboard</h1>
                    </div>
                    <Link
                        href="/recruit/logout"
                        className="group inline-block bg-black p-[2px] transition-all active:scale-[0.97] hover:bg-red"
                        style={{ clipPath: LOGOUT_CLIP }}
                    >
                        <span
                            className="flex items-center gap-2 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-black transition-all group-hover:bg-red group-hover:text-white"
                            style={{ clipPath: LOGOUT_CLIP }}
                        >
                            Logout
                        </span>
                    </Link>
                </div>

                {error && (
                    <div className="border-2 border-red/30 bg-red/5 p-4 text-sm text-red font-bold text-center">
                        {error}
                    </div>
                )}

                {profile && (
                    <EmailVerifyBanner
                        srmEmail={profile.srm_email}
                        verified={profile.srm_email_verified}
                        onVerified={() => setProfile((p) => (p ? { ...p, srm_email_verified: true } : p))}
                    />
                )}

                {profile && (
                    <div className={CARD_OUTER} style={{ clipPath: CARD_CLIP }}>
                    <div className={CARD_INNER} style={{ clipPath: CARD_CLIP }}>
                        <p className="font-mono text-xs uppercase tracking-widest text-black/40 mb-1">// profile</p>
                        <h2 className="text-xl font-bold mb-4 text-black">{profile.name}</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono text-sm">
                            <div>
                                <p className="text-black/40 text-xs uppercase tracking-widest">SRM Email</p>
                                <p className="text-black/80 break-all">{profile.srm_email}</p>
                            </div>
                            <div>
                                <p className="text-black/40 text-xs uppercase tracking-widest">Reg No</p>
                                <p className="text-black/80">{profile.reg_no}</p>
                            </div>
                            <div>
                                <p className="text-black/40 text-xs uppercase tracking-widest">Year</p>
                                <p className="text-black/80">{profile.year}</p>
                            </div>
                            <div>
                                <p className="text-black/40 text-xs uppercase tracking-widest">Gender</p>
                                <p className="text-black/80">{genderLabel(profile.gender)}</p>
                            </div>
                            <div>
                                <p className="text-black/40 text-xs uppercase tracking-widest">Department</p>
                                <p className="text-black/80">{profile.department}</p>
                            </div>
                            <div>
                                <p className="text-black/40 text-xs uppercase tracking-widest">Course</p>
                                <p className="text-black/80">{profile.course}</p>
                            </div>
                            <div>
                                <p className="text-black/40 text-xs uppercase tracking-widest">Stay</p>
                                <p className="text-black/80">
                                    {profile.is_hosteller
                                        ? [profile.hostel_block, profile.hostel_room].filter(Boolean).join(" · ")
                                        : "Day Scholar"}
                                </p>
                            </div>
                            {profile.portfolio_url && (
                                <div>
                                    <p className="text-black/40 text-xs uppercase tracking-widest">LinkedIn</p>
                                    <a
                                        href={profile.portfolio_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-red hover:text-red/80 break-all"
                                    >
                                        {profile.portfolio_url}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                )}

                {badgeImage && (
                    <div className="p-6 md:p-8 w-full flex flex-col items-center justify-center">
                        <LanyardBadge badgeImage={badgeImage} />
                        <div className="text-center mt-4 pb-8">
                            <a
                                href={badgeImage}
                                download={`robocon-recruit-tag-${profile?.reg_no ?? "id"}.png`}
                                className="group relative inline-flex items-center gap-2 overflow-hidden bg-red px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97]"
                                style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                            >
                                <span
                                    className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                                    style={{
                                        clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                                        backgroundColor: "#D4AF37",
                                    }}
                                />
                                <Download className="relative w-4 h-4 transition-colors duration-200 group-hover:text-black" />
                                <span className="relative transition-colors duration-200 group-hover:text-black">
                                    Download QR
                                </span>
                            </a>
                        </div>
                    </div>
                )}

                <div className={CARD_OUTER} style={{ clipPath: CARD_CLIP }}>
                <div className={CARD_INNER} style={{ clipPath: CARD_CLIP }}>
                    <p className="font-mono text-xs uppercase tracking-widest text-black/40 mb-4">// pipeline status</p>
                    <div className="space-y-3">
                        {domains.length === 0 && (
                            <p className="text-sm text-black/40 font-mono">No domain selections found.</p>
                        )}
                        {domains.map((d) => (
                            <div
                                key={d.sub_domain}
                                className="flex items-center justify-between border border-black/15 px-4 py-3 bg-black/[0.02]"
                            >
                                <span className="font-mono text-sm font-bold text-black/80">
                                    <span className="text-black/40 text-xs">{subDomainSubsystem(d.sub_domain)} · </span>
                                    {subDomainLabel(d.sub_domain)}
                                </span>
                                <span
                                    className={`font-mono text-xs font-bold uppercase tracking-widest border px-3 py-1 ${statusBadgeClass(
                                        d.status
                                    )}`}
                                >
                                    {d.status}
                                </span>
                            </div>
                        ))}
                    </div>

                    {SHOW_TRAINING_ATTENDANCE && training?.started && (
                        <div className="mt-6 pt-6 border-t border-black/10">
                            <p className="font-mono text-xs uppercase tracking-widest text-black/40 mb-2">
                                Training Attendance
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 h-2.5 bg-black/10 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                                        style={{ width: `${training.percentage ?? 0}%` }}
                                    />
                                </div>
                                <span className="font-mono text-sm font-bold text-blue-700 whitespace-nowrap">
                                    {training.attended} / {training.total} ({training.percentage ?? 0}%)
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                </div>

                {interview && (
                    <div className={CARD_OUTER} style={{ clipPath: CARD_CLIP }}>
                    <div
                        className={`${CARD_INNER} ${
                            interview.status === "called" ? "animate-pulse" : ""
                        }`}
                        style={{ clipPath: CARD_CLIP }}
                    >
                        <p className="font-mono text-xs uppercase tracking-widest text-black/40 mb-1">
                            // interview queue
                        </p>
                        <h2 className="text-xl font-bold mb-4 text-black">{interview.panel_label}</h2>
                        {interview.status === "called" ? (
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold uppercase tracking-widest border border-purple-600 bg-purple-50 text-purple-700 px-3 py-1 animate-pulse">
                                    You&apos;re being called now
                                </span>
                                <span className="text-sm text-black/60">Head to the panel!</span>
                            </div>
                        ) : interview.status === "deferred" ? (
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold uppercase tracking-widest border border-amber-600 bg-amber-50 text-amber-700 px-3 py-1">
                                    Table closed for the day
                                </span>
                                <span className="text-sm text-black/60">You&apos;ll be interviewed on another day — watch for an announcement.</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-2xl font-black text-red">
                                    #{interview.waiting_ahead + 1}
                                </span>
                                <span className="text-sm text-black/60">
                                    {interview.waiting_ahead === 0
                                        ? "You're next!"
                                        : `${interview.waiting_ahead} recruit${
                                              interview.waiting_ahead === 1 ? "" : "s"
                                          } ahead of you`}
                                </span>
                            </div>
                        )}
                    </div>
                    </div>
                )}

                <FaqSection />
                <TicketsSection currentDomains={domains.map((d) => d.sub_domain)} />
            </div>

            <ChatWidget theme="light" />
        </div>
    );
}
