"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PasswordToggle from "@/components/PasswordToggle";
import AuthNav from "@/components/AuthNav";

function RecruitLoginInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const googleError = searchParams.get("error") || "";

    const [srmEmail, setSrmEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(
        googleError === "google_not_configured"
            ? "Google sign-in isn't configured yet."
            : googleError === "google_auth_failed"
            ? "Google sign-in failed. Please try again."
            : googleError === "no_active_cycle"
            ? "Recruitment isn't open right now."
            : googleError === "google_state_mismatch"
            ? "Google sign-in session expired or was opened twice. Please try again."
            : ""
    );

    const handleGoogleLogin = () => {
        window.location.href = "/api/recruit/auth/google";
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/recruit/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ srm_email: srmEmail, password }),
            });
            const data = await res.json();
            if (res.ok && data.redirect) {
                router.push(data.redirect);
            } else {
                setError(data.error || "Invalid credentials");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-white p-5">
            <div className="w-full max-w-md">
                <AuthNav variant="sharp" />
                <div className="border-2 border-red bg-white p-8">
                    <div className="flex justify-center mb-8">
                        <Image
                            src="/LOGO.png"
                            alt="Robocon Logo"
                            width={160}
                            height={160}
                            className="object-contain"
                            unoptimized
                        />
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">Recruit Login</h2>
                        <p className="mt-2 text-sm text-black/50">SRM Team Robocon recruitment portal</p>
                    </div>

                    <div className="space-y-5">
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="flex w-full items-center justify-center gap-3 border-2 border-red bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-red hover:text-white hover:border-red active:scale-[0.99] shadow-sm transition-all"
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
                            Sign in with Google
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-black/15" />
                            <span className="text-xs text-black/40">or</span>
                            <div className="h-px flex-1 bg-black/15" />
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label htmlFor="srmEmail" className="block text-sm font-medium leading-6 text-black/70">
                                    SRM Email
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="srmEmail"
                                        name="srmEmail"
                                        type="email"
                                        autoComplete="username"
                                        required
                                        value={srmEmail}
                                        onChange={(e) => setSrmEmail(e.target.value)}
                                        className="block w-full border-2 border-black/15 bg-white py-3 px-4 text-black placeholder:text-black/30 shadow-sm outline-none focus:border-red focus:ring-2 focus:ring-red/20 sm:text-sm sm:leading-6 transition-all"
                                        placeholder="ab1234@srmist.edu.in"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium leading-6 text-black/70">
                                    Password
                                </label>
                                <div className="mt-2 relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full border-2 border-black/15 bg-white py-3 px-4 pr-11 text-black placeholder:text-black/30 shadow-sm outline-none focus:border-red focus:ring-2 focus:ring-red/20 sm:text-sm sm:leading-6 transition-all"
                                        placeholder="Enter your password"
                                    />
                                    <PasswordToggle
                                        shown={showPassword}
                                        onToggle={() => setShowPassword((s) => !s)}
                                        className="text-black/40 hover:text-black/70"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="border-2 border-red/30 bg-red/5 p-4 flex items-center justify-center">
                                    <h3 className="text-sm text-red font-bold">{error}</h3>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`group relative flex w-full items-center justify-center overflow-hidden px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] ${
                                    loading
                                        ? "bg-red/40 cursor-not-allowed"
                                        : "bg-red hover:bg-red/90"
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
                                    {loading ? "Signing in..." : "Sign In"}
                                </span>
                            </button>

                            <p className="text-center text-sm text-black/50">
                                New recruit?{" "}
                                <Link href="/recruit/register" className="text-red hover:text-red/80 font-semibold">
                                    Register here
                                </Link>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function RecruitLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-[100dvh] bg-white" />}>
            <RecruitLoginInner />
        </Suspense>
    );
}
