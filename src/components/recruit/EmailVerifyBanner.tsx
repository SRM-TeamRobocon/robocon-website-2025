"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { recruitFetch } from "@/lib/recruit-fetch-client";

// Soft, dismissible prompt for a recruit to verify their SRM email post-signup — SRM
// email OTP verification was moved out of the registration wizard (see
// src/app/api/recruit/auth/complete-registration/route.ts), so a recruit can land on the
// dashboard with srm_email_verified = false. This never blocks anything; it's a nudge.
//
// Sharp red/white/black poster theme to match the redesigned dashboard this sits in —
// NOT the old dark-glass look used elsewhere in this directory (GlassCard, RecruitBackdrop).
export default function EmailVerifyBanner({
    srmEmail,
    verified,
    onVerified,
}: {
    srmEmail: string;
    verified: boolean;
    onVerified?: () => void;
}) {
    const router = useRouter();
    const [dismissed, setDismissed] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState("");
    const [sendLoading, setSendLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [error, setError] = useState("");

    if (verified || dismissed) return null;

    const handleSendOtp = async () => {
        setError("");
        setSendLoading(true);
        try {
            const res = await recruitFetch("/api/recruit/verify-email/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (res.status === 401) {
                // Session expired — same dead-end as TicketsSection's raw "Unauthorized
                // access" body; send them to log back in instead of showing it inline.
                router.push("/recruit/login");
                return;
            }
            const data = await res.json();
            if (res.ok && data.sent) {
                setOtpSent(true);
            } else {
                setError(data.error || "Could not send OTP.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setSendLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setVerifyLoading(true);
        try {
            const res = await recruitFetch("/api/recruit/verify-email/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ otp }),
            });
            if (res.status === 401) {
                router.push("/recruit/login");
                return;
            }
            const data = await res.json();
            if (res.ok && data.verified) {
                onVerified?.();
            } else {
                setError(data.error || "Invalid OTP.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setVerifyLoading(false);
        }
    };

    return (
        <div
            className="relative w-full border-2 border-black bg-red/5 p-4 sm:p-5"
            style={{ clipPath: "polygon(0 0,100% 0,100% 92%,98% 100%,0 100%)" }}
        >
            <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="absolute right-3 top-3 text-black/40 hover:text-black transition-colors"
            >
                &times;
            </button>

            <div className="pr-6">
                <div className="mb-1 inline-block bg-red px-2.5 py-0.5 text-[10px] font-bold tracking-[0.25em] text-white">
                    ACTION AVAILABLE
                </div>
                <h3 className="text-sm font-bold text-black sm:text-base">Verify your SRM email</h3>
                <p className="mt-1 text-xs text-black/60 sm:text-sm">
                    <span className="font-semibold text-black">{srmEmail}</span> hasn&apos;t been verified yet. This is
                    optional but recommended.
                </p>
            </div>

            {error && (
                <div className="mt-3 border-2 border-red/30 bg-white p-2.5 text-center">
                    <p className="text-xs font-bold text-red">{error}</p>
                </div>
            )}

            {!otpSent ? (
                <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendLoading}
                    className={`group relative mt-3 flex items-center justify-center overflow-hidden px-6 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ${
                        sendLoading ? "bg-red/40 cursor-not-allowed" : "bg-red hover:bg-red/90"
                    }`}
                    style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                >
                    <span
                        className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                        style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)", backgroundColor: "#D4AF37" }}
                    />
                    <span className="relative z-10 transition-colors duration-200 group-hover:text-black">
                        {sendLoading ? "Sending..." : "Send OTP"}
                    </span>
                </button>
            ) : (
                <form onSubmit={handleVerifyOtp} className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        className="w-28 border-2 border-black/15 bg-white px-3 py-2 text-center text-sm tracking-[0.3em] text-black placeholder:text-black/30 outline-none focus:border-red focus:ring-2 focus:ring-red/20 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={verifyLoading || otp.length !== 6}
                        className={`group relative flex items-center justify-center overflow-hidden px-6 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ${
                            verifyLoading || otp.length !== 6 ? "bg-red/40 cursor-not-allowed" : "bg-red hover:bg-red/90"
                        }`}
                        style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                    >
                        <span
                            className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                            style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)", backgroundColor: "#D4AF37" }}
                        />
                        <span className="relative z-10 transition-colors duration-200 group-hover:text-black">
                            {verifyLoading ? "Verifying..." : "Verify"}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setOtpSent(false);
                            setOtp("");
                            setError("");
                        }}
                        className="text-xs font-semibold text-black/50 hover:text-black transition-colors"
                    >
                        Resend
                    </button>
                </form>
            )}
        </div>
    );
}
