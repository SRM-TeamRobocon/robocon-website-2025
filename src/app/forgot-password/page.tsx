"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import PasswordToggle from "@/components/PasswordToggle";
import AuthNav from "@/components/AuthNav";

type Step = "request" | "reset" | "done";

export default function ForgotPassword() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("request");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [loading, setLoading] = useState(false);

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/member/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setInfo(data.message || "Check your inbox for a reset code.");
                setStep("reset");
            } else {
                setError(data.error || "Could not send reset code.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/member/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp, newPassword }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setStep("done");
                setTimeout(() => router.push("/login"), 2000);
            } else {
                setError(data.error || "Could not reset password.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative z-10 p-5">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* On the reset step, Back returns to the email form rather than leaving the flow. */}
                <AuthNav onBack={step === "reset" ? () => setStep("request") : undefined} />
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 p-8 shadow-2xl">
                    <div className="flex justify-center mb-6">
                        <Image src="/LOGO.png" alt="Robocon Logo" width={120} height={120} className="object-contain" unoptimized />
                    </div>

                    {step === "request" && (
                        <>
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Forgot Password</h2>
                                <p className="mt-2 text-sm text-gray-400">Enter your email to receive a reset code</p>
                            </div>
                            <form onSubmit={handleRequestOtp} className="space-y-5">
                                <Field
                                    label="Email"
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="jane@srmist.edu.in"
                                />
                                {error && <ErrorBox message={error} />}
                                <SubmitButton loading={loading} label="Send Reset Code" loadingLabel="Sending..." />
                                <BackToLogin />
                            </form>
                        </>
                    )}

                    {step === "reset" && (
                        <>
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Enter Reset Code</h2>
                                <p className="mt-2 text-sm text-gray-400">{info}</p>
                                <p className="mt-1 text-xs text-gray-500">Don&apos;t see it? Check your spam/junk folder too.</p>
                            </div>
                            <form onSubmit={handleResetPassword} className="space-y-5">
                                <Field
                                    label="Reset Code"
                                    id="otp"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="6-digit code"
                                />
                                <Field
                                    label="New Password"
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                />
                                <Field
                                    label="Confirm New Password"
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                />
                                {error && <ErrorBox message={error} />}
                                <SubmitButton loading={loading} label="Reset Password" loadingLabel="Resetting..." />
                                <p className="text-center text-sm text-gray-400">
                                    Didn&apos;t get a code?{" "}
                                    <button
                                        type="button"
                                        onClick={() => setStep("request")}
                                        className="text-red hover:text-red/80"
                                    >
                                        Try again
                                    </button>
                                </p>
                                <BackToLogin />
                            </form>
                        </>
                    )}

                    {step === "done" && (
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-3">Password reset</h2>
                            <p className="text-sm text-gray-400">Redirecting you to login...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function BackToLogin() {
    return (
        <p className="text-center text-sm text-gray-400">
            Remembered your password?{" "}
            <Link href="/login" className="text-red hover:text-red/80">
                Log in
            </Link>
        </p>
    );
}

function ErrorBox({ message }: { message: string }) {
    return (
        <div className="bg-red-500/10 border border-red-500/20 p-4 flex items-center justify-center">
            <h3 className="text-sm text-red font-bold">{message}</h3>
        </div>
    );
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className={`group relative flex w-full items-center justify-center overflow-hidden px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] ${
                loading ? "bg-red/40 cursor-not-allowed" : "bg-red"
            }`}
            style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
        >
            <span
                className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                style={{
                    clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                    backgroundColor: "#D4AF37",
                }}
            />
            <span className="relative z-10 transition-colors duration-200 group-hover:text-black">
                {loading ? loadingLabel : label}
            </span>
        </button>
    );
}

function Field({
    label,
    id,
    type = "text",
    value,
    onChange,
    placeholder,
}: {
    label: string;
    id: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium leading-6 text-gray-300">
                {label}
            </label>
            <div className="mt-2 relative">
                <input
                    id={id}
                    name={id}
                    type={isPassword && showPassword ? "text" : type}
                    required
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={`block w-full border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-red/50 sm:text-sm sm:leading-6 transition-all ${
                        isPassword ? "pr-11" : ""
                    }`}
                />
                {isPassword && (
                    <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />
                )}
            </div>
        </div>
    );
}
