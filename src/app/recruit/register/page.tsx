"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { groupBySubsystem } from "@/lib/recruit-domains";
import { HOSTEL_BLOCKS } from "@/lib/hostel-blocks";
import { TRAVEL_METHODS } from "@/lib/travel-method";
import PasswordToggle from "@/components/PasswordToggle";
import RecruitBackdrop from "@/components/recruit/RecruitBackdrop";
import GlassCard from "@/components/recruit/GlassCard";
import AuthNav from "@/components/AuthNav";
import Select from "@/components/ui/select";

const DOMAIN_GROUPS = groupBySubsystem();

type ProfileForm = {
    name: string;
    regNo: string;
    year: "" | "1" | "2";
    department: string;
    course: string;
    phone: string;
    isHosteller: boolean;
    hostelBlock: string;
    hostelRoom: string;
    dayScholarArea: string;
    travelMethod: "" | "own_vehicle" | "college_bus";
    password: string;
    confirmPassword: string;
    portfolioUrl: string;
};

function CardShell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
    return (
        <div className="min-h-screen flex items-center justify-center relative z-10 p-5 overflow-hidden">
            <RecruitBackdrop />
            <div className="w-full max-w-lg relative z-10">
                <AuthNav variant="glass" onBack={onBack} />
                <GlassCard contentClassName="p-8" borderRadius={32}>
                    <div className="flex justify-center mb-6">
                        <Image
                            src="/LOGO.png"
                            alt="Robocon Logo"
                            width={120}
                            height={120}
                            className="object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                            unoptimized
                        />
                    </div>
                    {children}
                </GlassCard>
            </div>
        </div>
    );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
    return (
        <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
                <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                        s === step ? "w-8 bg-red" : s < step ? "w-8 bg-red/40" : "w-8 bg-white/15"
                    }`}
                />
            ))}
        </div>
    );
}

function ErrorBanner({ message }: { message: string }) {
    if (!message) return null;
    return (
        <div className="rounded-lg bg-red/10 border border-red/25 p-4 flex items-center justify-center">
            <h3 className="text-sm text-red font-bold">{message}</h3>
        </div>
    );
}

function RecruitmentIntro({ onComplete }: { onComplete: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [needsUserGesture, setNeedsUserGesture] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.muted = false;
        video.volume = 1;
        void video.play().catch(() => setNeedsUserGesture(true));
    }, []);

    const startWithAudio = async () => {
        const video = videoRef.current;
        if (!video) return;

        video.muted = false;
        video.volume = 1;
        try {
            await video.play();
            setNeedsUserGesture(false);
        } catch {
            setNeedsUserGesture(true);
        }
    };

    return (
        <section className="fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-black text-white">
            <video
                ref={videoRef}
                className="h-full w-full object-contain"
                src="/intro.mp4"
                autoPlay
                muted={false}
                playsInline
                preload="auto"
                onEnded={onComplete}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-end sm:p-8">
                {needsUserGesture && (
                    <button
                        type="button"
                        onClick={startWithAudio}
                        className="rounded-full border border-white/30 bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur transition hover:bg-white hover:text-black"
                    >
                        Touch your screen to start with audio
                    </button>
                )}
                <button
                    type="button"
                    onClick={onComplete}
                    className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 transition hover:text-white"
                >
                    Skip intro
                </button>
            </div>
        </section>
    );
}

function RecruitRegisterInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const googleName = searchParams.get("name") || "";
    const googleEmail = searchParams.get("email") || "";
    const googleError = searchParams.get("error") || "";
    const [showIntro, setShowIntro] = useState(() => !googleName && !googleEmail && !googleError);

    // Presence of the name/email query params (set by the Google callback redirect)
    // is the client-visible signal that a recruit_oauth_state cookie now exists.
    const [step, setStep] = useState<1 | 2 | 3>(googleName || googleEmail ? 2 : 1);

    const [srmEmail, setSrmEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);

    const [profile, setProfile] = useState<ProfileForm>({
        name: googleName,
        regNo: "",
        year: "",
        department: "",
        course: "",
        phone: "",
        isHosteller: false,
        hostelBlock: "",
        hostelRoom: "",
        dayScholarArea: "",
        travelMethod: "",
        password: "",
        confirmPassword: "",
        portfolioUrl: "",
    });
    const [domains, setDomains] = useState<string[]>([]);
    const [submitLoading, setSubmitLoading] = useState(false);

    const [error, setError] = useState(
        googleError === "google_not_configured"
            ? "Google sign-in isn't configured yet."
            : googleError === "google_auth_failed"
            ? "Google sign-in failed. Please try again."
            : googleError === "no_active_cycle"
            ? "Recruitment isn't open right now."
            : googleError === "google_state_mismatch"
            ? "That sign-in link didn't originate from this browser. Please start again."
            : ""
    );

    const updateProfile = (field: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setProfile((prev) => ({ ...prev, [field]: field === "regNo" ? e.target.value.toUpperCase() : e.target.value }));

    const toggleDomain = (value: string) => {
        setDomains((prev) => {
            if (prev.includes(value)) return prev.filter((d) => d !== value);
            if (prev.length >= 2) return prev;
            return [...prev, value];
        });
    };

    const handleGoogleContinue = () => {
        window.location.href = "/api/recruit/auth/google";
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setOtpLoading(true);
        try {
            const res = await fetch("/api/recruit/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ srm_email: srmEmail }),
            });
            const data = await res.json();
            if (res.ok && data.sent) {
                setOtpSent(true);
            } else {
                setError(data.error || "Could not send OTP.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setVerifyLoading(true);
        try {
            const res = await fetch("/api/recruit/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ srm_email: srmEmail, otp }),
            });
            const data = await res.json();
            if (res.ok && data.verified) {
                setStep(3);
            } else {
                setError(data.error || "Invalid OTP.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleCompleteRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (domains.length < 1) {
            setError("Select at least 1 domain.");
            return;
        }
        if (profile.password !== profile.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (!profile.portfolioUrl.trim()) {
            setError("LinkedIn URL is required.");
            return;
        }
        if (profile.isHosteller && !profile.hostelBlock) {
            setError("Select your hostel block.");
            return;
        }
        if (profile.isHosteller && !profile.hostelRoom.trim()) {
            setError("Enter your hostel room number.");
            return;
        }
        if (!profile.isHosteller && !profile.dayScholarArea.trim()) {
            setError("Enter the area you live in.");
            return;
        }
        if (!profile.isHosteller && !profile.travelMethod) {
            setError("Select how you travel to college.");
            return;
        }

        setSubmitLoading(true);
        try {
            const res = await fetch("/api/recruit/auth/complete-registration", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: profile.name,
                    reg_no: profile.regNo,
                    year: profile.year,
                    department: profile.department,
                    course: profile.course,
                    phone: profile.phone,
                    is_hosteller: profile.isHosteller,
                    hostel_block: profile.isHosteller ? profile.hostelBlock : null,
                    hostel_room: profile.isHosteller ? profile.hostelRoom : null,
                    day_scholar_area: !profile.isHosteller ? profile.dayScholarArea : null,
                    travel_method: !profile.isHosteller ? profile.travelMethod : null,
                    password: profile.password,
                    domains,
                    portfolio_url: profile.portfolioUrl || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok && data.redirect) {
                router.push(data.redirect);
            } else {
                setError(data.error || "Registration failed.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setSubmitLoading(false);
        }
    };

    // Back walks the wizard backwards one sub-step at a time (profile → OTP → email →
    // Google). Only on step 1 is there nothing left to undo, so it falls through to
    // AuthNav's default history-back behaviour.
    const stepBack =
        step === 3
            ? () => {
                  setError("");
                  setStep(2);
              }
            : step === 2 && otpSent
            ? () => {
                  setError("");
                  setOtp("");
                  setOtpSent(false);
              }
            : step === 2
            ? () => {
                  setError("");
                  setStep(1);
              }
            : undefined;

    if (showIntro) {
        return <RecruitmentIntro onComplete={() => setShowIntro(false)} />;
    }

    return (
        <CardShell onBack={stepBack}>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Recruit Registration</h2>
                <p className="mt-2 text-sm text-white/50">SRM Team Robocon — {new Date().getFullYear()} recruitment</p>
            </div>

            <StepIndicator step={step} />

            {step === 1 && (
                <div className="space-y-5">
                    <p className="text-sm text-white/50 text-center">
                        Start with your Google account to pull in your name and email.
                    </p>
                    <button
                        type="button"
                        onClick={handleGoogleContinue}
                        className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 hover:bg-white/15 active:scale-[0.99] shadow-sm transition-all"
                    >
                        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                            <path
                                fill="#FFC107"
                                d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                            />
                            <path
                                fill="#FF3D00"
                                d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                            />
                            <path
                                fill="#4CAF50"
                                d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                            />
                            <path
                                fill="#1976D2"
                                d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                            />
                        </svg>
                        Continue with Google
                    </button>
                    <ErrorBanner message={error} />
                    <p className="text-center text-sm text-white/50">
                        Already registered?{" "}
                        <Link href="/recruit/login" className="text-red hover:text-red/80 font-semibold">
                            Log in
                        </Link>
                    </p>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-5">
                    {googleName && (
                        <p className="text-sm text-white/50 text-center">
                            Welcome, <span className="text-white font-semibold">{googleName}</span>. Verify your SRM email to continue.
                        </p>
                    )}
                    {!otpSent ? (
                        <form onSubmit={handleSendOtp} className="space-y-5">
                            <div>
                                <label htmlFor="srmEmail" className="block text-sm font-medium leading-6 text-white/70">
                                    SRM Email
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="srmEmail"
                                        type="email"
                                        required
                                        value={srmEmail}
                                        onChange={(e) => setSrmEmail(e.target.value)}
                                        placeholder="ab1234@srmist.edu.in"
                                        className="block w-full rounded-xl border-0 bg-white/10 py-3 px-4 text-white placeholder:text-white/30 shadow-sm ring-1 ring-inset ring-white/15 focus:ring-2 focus:ring-inset focus:ring-red/50 sm:text-sm sm:leading-6 transition-all"
                                    />
                                </div>
                            </div>
                            <ErrorBanner message={error} />
                            <button
                                type="submit"
                                disabled={otpLoading}
                                className={`flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99] transition-all ${
                                    otpLoading
                                        ? "bg-red/40 cursor-not-allowed"
                                        : "bg-red hover:bg-red/90 hover:shadow-lg hover:shadow-red/25"
                                }`}
                            >
                                {otpLoading ? "Sending..." : "Send OTP"}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <p className="text-sm text-white/50 text-center">
                                Enter the 6-digit code sent to <span className="text-white font-semibold">{srmEmail}</span>.
                            </p>
                            <p className="text-xs text-white/40 text-center -mt-3">
                                Don&apos;t see it? Check your spam/junk folder too.
                            </p>
                            <div>
                                <label htmlFor="otp" className="block text-sm font-medium leading-6 text-white/70">
                                    OTP
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="otp"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]{6}"
                                        maxLength={6}
                                        required
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                        placeholder="123456"
                                        className="block w-full rounded-xl border-0 bg-white/10 py-3 px-4 text-white placeholder:text-white/30 shadow-sm ring-1 ring-inset ring-white/15 focus:ring-2 focus:ring-inset focus:ring-red/50 sm:text-sm sm:leading-6 transition-all tracking-[0.3em] text-center"
                                    />
                                </div>
                            </div>
                            <ErrorBanner message={error} />
                            <button
                                type="submit"
                                disabled={verifyLoading}
                                className={`flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99] transition-all ${
                                    verifyLoading
                                        ? "bg-red/40 cursor-not-allowed"
                                        : "bg-red hover:bg-red/90 hover:shadow-lg hover:shadow-red/25"
                                }`}
                            >
                                {verifyLoading ? "Verifying..." : "Verify OTP"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setOtpSent(false);
                                    setOtp("");
                                    setError("");
                                }}
                                className="w-full text-center text-sm text-red hover:text-red/80 font-semibold"
                            >
                                Use a different email
                            </button>
                        </form>
                    )}
                </div>
            )}

            {step === 3 && (
                <form onSubmit={handleCompleteRegistration} className="space-y-5">
                    <p className="text-sm text-white/50 text-center">SRM email verified. Complete your profile.</p>

                    <Field label="Full Name" id="name" value={profile.name} onChange={updateProfile("name")} placeholder="Full name" />
                    <Field
                        label="Registration Number"
                        id="regNo"
                        value={profile.regNo}
                        onChange={updateProfile("regNo")}
                        placeholder="RA2211026010001"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="year" className="block text-sm font-medium leading-6 text-white/70">
                                Year
                            </label>
                            <div className="mt-2">
                                <Select
                                    id="year"
                                    value={profile.year}
                                    onChange={(v) => setProfile((prev) => ({ ...prev, year: v as ProfileForm["year"] }))}
                                    placeholder="Select year"
                                    options={[
                                        { value: "1", label: "1st Year" },
                                        { value: "2", label: "2nd Year" },
                                    ]}
                                />
                            </div>
                        </div>
                        <Field label="Department" id="department" value={profile.department} onChange={updateProfile("department")} placeholder="CSE" />
                    </div>

                    <Field label="Course" id="course" value={profile.course} onChange={updateProfile("course")} placeholder="B.Tech" />
                    <Field
                        label="Phone"
                        id="phone"
                        type="tel"
                        value={profile.phone}
                        onChange={updateProfile("phone")}
                        placeholder="9876543210"
                    />

                    <div>
                        <label className="block text-sm font-medium leading-6 text-white/70 mb-2">
                            Do you stay in a hostel?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: "Hosteller", value: true },
                                { label: "Day Scholar", value: false },
                            ].map((opt) => {
                                const checked = profile.isHosteller === opt.value;
                                return (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        onClick={() =>
                                            setProfile((prev) => ({
                                                ...prev,
                                                isHosteller: opt.value,
                                                // Clear block/room when switching to day scholar, and
                                                // clear area/travel method when switching to hosteller —
                                                // in both directions this stops a half-filled residence
                                                // pairing from being submitted (the DB check constraint
                                                // rejects a hosteller carrying day-scholar fields anyway).
                                                hostelBlock: opt.value ? prev.hostelBlock : "",
                                                hostelRoom: opt.value ? prev.hostelRoom : "",
                                                dayScholarArea: opt.value ? "" : prev.dayScholarArea,
                                                travelMethod: opt.value ? "" : prev.travelMethod,
                                            }))
                                        }
                                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.99] ${
                                            checked
                                                ? "bg-red/15 border-red/50 text-white"
                                                : "bg-white/5 border-white/10 text-white/60 hover:border-white/25"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {profile.isHosteller && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="hostelBlock" className="block text-sm font-medium leading-6 text-white/70">
                                    Hostel Block
                                </label>
                                <div className="mt-2">
                                    <Select
                                        id="hostelBlock"
                                        value={profile.hostelBlock}
                                        onChange={(v) => setProfile((prev) => ({ ...prev, hostelBlock: v }))}
                                        placeholder="Select block"
                                        options={HOSTEL_BLOCKS.map((block) => ({ value: block, label: block }))}
                                    />
                                </div>
                            </div>
                            <Field
                                label="Room Number"
                                id="hostelRoom"
                                value={profile.hostelRoom}
                                onChange={updateProfile("hostelRoom")}
                                placeholder="e.g. 312"
                            />
                        </div>
                    )}

                    {!profile.isHosteller && (
                        <div className="space-y-4">
                            <Field
                                label="Which area do you live in?"
                                id="dayScholarArea"
                                value={profile.dayScholarArea}
                                onChange={updateProfile("dayScholarArea")}
                                placeholder="e.g. Tambaram"
                            />
                            <div>
                                <label className="block text-sm font-medium leading-6 text-white/70 mb-2">
                                    How do you travel to college?
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TRAVEL_METHODS.map((opt) => {
                                        const checked = profile.travelMethod === opt.key;
                                        return (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                onClick={() =>
                                                    setProfile((prev) => ({ ...prev, travelMethod: opt.key }))
                                                }
                                                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.99] ${
                                                    checked
                                                        ? "bg-red/15 border-red/50 text-white"
                                                        : "bg-white/5 border-white/10 text-white/60 hover:border-white/25"
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium leading-6 text-white/70 mb-2">
                            Domains <span className="text-white/40">(choose 1–2)</span>
                        </label>
                        <div className="space-y-3">
                            {DOMAIN_GROUPS.map((group) => (
                                <div key={group.subsystem}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
                                        {group.subsystem}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {group.domains.map((opt) => {
                                            const checked = domains.includes(opt.key);
                                            const disabled = !checked && domains.length >= 2;
                                            return (
                                                <label
                                                    key={opt.key}
                                                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all cursor-pointer ${
                                                        checked
                                                            ? "bg-red/10 border-red/40 text-white"
                                                            : disabled
                                                            ? "bg-white/[0.03] border-white/5 text-white/30 cursor-not-allowed"
                                                            : "bg-white/5 border-white/10 text-white/70 hover:border-white/20"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="accent-red"
                                                        checked={checked}
                                                        disabled={disabled}
                                                        onChange={() => toggleDomain(opt.key)}
                                                    />
                                                    {opt.label}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Field
                        label="LinkedIn URL"
                        id="portfolioUrl"
                        value={profile.portfolioUrl}
                        onChange={updateProfile("portfolioUrl")}
                        placeholder="https://linkedin.com/in/your-profile"
                    />

                    <Field
                        label="Password"
                        id="password"
                        type="password"
                        value={profile.password}
                        onChange={updateProfile("password")}
                        placeholder="At least 8 characters"
                    />
                    <Field
                        label="Confirm Password"
                        id="confirmPassword"
                        type="password"
                        value={profile.confirmPassword}
                        onChange={updateProfile("confirmPassword")}
                        placeholder="Re-enter password"
                    />

                    <ErrorBanner message={error} />

                    <button
                        type="submit"
                        disabled={submitLoading}
                        className={`flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99] transition-all ${
                            submitLoading
                                ? "bg-red/40 cursor-not-allowed"
                                : "bg-red hover:bg-red/90 hover:shadow-lg hover:shadow-red/25"
                        }`}
                    >
                        {submitLoading ? "Creating account..." : "Complete Registration"}
                    </button>
                </form>
            )}
        </CardShell>
    );
}

function Field({
    label,
    id,
    type = "text",
    value,
    onChange,
    placeholder,
    required = true,
}: {
    label: string;
    id: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium leading-6 text-white/70">
                {label}
            </label>
            <div className="mt-2 relative">
                <input
                    id={id}
                    name={id}
                    type={isPassword && showPassword ? "text" : type}
                    required={required}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={`block w-full rounded-xl border-0 bg-white/10 py-3 px-4 text-white placeholder:text-white/30 shadow-sm ring-1 ring-inset ring-white/15 focus:ring-2 focus:ring-inset focus:ring-red/50 sm:text-sm sm:leading-6 transition-all ${
                        isPassword ? "pr-11" : ""
                    }`}
                />
                {isPassword && (
                    <PasswordToggle
                        shown={showPassword}
                        onToggle={() => setShowPassword((s) => !s)}
                        className="text-white/40 hover:text-white/70"
                    />
                )}
            </div>
        </div>
    );
}

export default function RecruitRegisterPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <RecruitRegisterInner />
        </Suspense>
    );
}
