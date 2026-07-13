"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
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
                                        className="text-blue-400 hover:text-blue-300"
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
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
                Log in
            </Link>
        </p>
    );
}

function ErrorBox({ message }: { message: string }) {
    return (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-center justify-center">
            <h3 className="text-sm text-red font-bold">{message}</h3>
        </div>
    );
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className={`flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all ${
                loading
                    ? "bg-blue-600/50 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 hover:shadow-lg hover:shadow-blue-500/25"
            }`}
        >
            {loading ? loadingLabel : label}
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
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium leading-6 text-gray-300">
                {label}
            </label>
            <div className="mt-2">
                <input
                    id={id}
                    name={id}
                    type={type}
                    required
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 transition-all"
                />
            </div>
        </div>
    );
}
