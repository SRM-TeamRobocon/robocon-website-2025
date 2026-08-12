"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PasswordToggle from "@/components/PasswordToggle";
import AuthNav from "@/components/AuthNav";

type Role = "member" | "recruit";

function Spinner() {
    return (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
        </svg>
    );
}

function GoogleIcon() {
    return (
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
    );
}

function RoleChooser({ onChoose }: { onChoose: (role: Role) => void }) {
    return (
        <div>
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Sign In</h2>
                <p className="mt-2 text-sm text-gray-400">Are you a team member or a recruit?</p>
            </div>
            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => onChoose("member")}
                    className="w-full text-left rounded-xl px-5 py-4 bg-white/5 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:ring-blue-500/50 active:scale-[0.99] transition-all"
                >
                    <span className="block text-sm font-semibold text-white">Team member</span>
                    <span className="block text-xs text-gray-400 mt-1">Lead, admin, or team member account</span>
                </button>
                <button
                    type="button"
                    onClick={() => onChoose("recruit")}
                    className="w-full text-left rounded-xl px-5 py-4 bg-white/5 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:ring-red-500/50 active:scale-[0.99] transition-all"
                >
                    <span className="block text-sm font-semibold text-white">Recruit</span>
                    <span className="block text-xs text-gray-400 mt-1">Applying this recruitment cycle</span>
                </button>
            </div>
        </div>
    );
}

function MemberForm() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                router.push("/dashboard");
                return;
            }
            setError(data.error || "Invalid email or password");
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Team Sign In</h2>
                <p className="mt-2 text-sm text-gray-400">For leads, admins, and team members</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium leading-6 text-gray-300">
                        Email
                    </label>
                    <div className="mt-2">
                        <input
                            id="username"
                            name="username"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 transition-all"
                            placeholder="Enter your SRM IST email"
                        />
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-300">
                            Password
                        </label>
                        <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
                            Forgot password?
                        </Link>
                    </div>
                    <div className="mt-2 relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 pr-11 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 transition-all"
                            placeholder="Enter your password"
                        />
                        <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-center justify-center">
                        <div className="flex">
                            <div className="ml-3">
                                <h3 className="text-sm text-red font-bold">{error}</h3>
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className={`flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-all ${loading
                                ? "bg-blue-600/50 cursor-not-allowed"
                                : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 hover:shadow-lg hover:shadow-blue-500/25"
                            }`}
                    >
                        {loading ? <Spinner /> : "Sign In"}
                    </button>
                </div>

                <p className="text-center text-sm text-gray-400">
                    No account yet?{" "}
                    <Link href="/signup" className="text-blue-400 hover:text-blue-300">
                        Team signup
                    </Link>
                </p>
            </form>
        </div>
    );
}

function RecruitForm() {
    const router = useRouter();
    const [srmEmail, setSrmEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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
                return;
            }
            setError(data.error || "Invalid credentials");
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Recruit Sign In</h2>
                <p className="mt-2 text-sm text-gray-400">SRM Team Robocon recruitment portal</p>
            </div>

            <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 mb-6 text-sm font-semibold text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 hover:bg-white/15 active:scale-[0.99] shadow-sm transition-all"
            >
                <GoogleIcon />
                Sign in with Google
            </button>

            <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-white/15" />
                <span className="text-xs text-gray-500">or</span>
                <div className="h-px flex-1 bg-white/15" />
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label htmlFor="srmEmail" className="block text-sm font-medium leading-6 text-gray-300">
                        SRM Email
                    </label>
                    <div className="mt-2">
                        <input
                            id="srmEmail"
                            name="srmEmail"
                            type="email"
                            required
                            value={srmEmail}
                            onChange={(e) => setSrmEmail(e.target.value)}
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 transition-all"
                            placeholder="ab1234@srmist.edu.in"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="recruitPassword" className="block text-sm font-medium leading-6 text-gray-300">
                        Password
                    </label>
                    <div className="mt-2 relative">
                        <input
                            id="recruitPassword"
                            name="recruitPassword"
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full rounded-xl border-0 bg-white/5 py-3 px-4 pr-11 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 transition-all"
                            placeholder="Enter your password"
                        />
                        <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-center justify-center">
                        <div className="flex">
                            <div className="ml-3">
                                <h3 className="text-sm text-red font-bold">{error}</h3>
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className={`flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-all ${loading
                                ? "bg-blue-600/50 cursor-not-allowed"
                                : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 hover:shadow-lg hover:shadow-blue-500/25"
                            }`}
                    >
                        {loading ? <Spinner /> : "Sign In"}
                    </button>
                </div>

                <p className="text-center text-sm text-gray-400">
                    New recruit?{" "}
                    <Link href="/recruit/register" className="text-blue-400 hover:text-blue-300">
                        Register here
                    </Link>
                </p>
            </form>
        </div>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const [checkingSession, setCheckingSession] = useState(true);
    const [role, setRole] = useState<Role | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/admin/me");
                const data = await res.json();
                if (!cancelled && data.success) {
                    router.replace("/dashboard");
                    return;
                }
            } catch {
                // Not logged in as a team member — keep checking.
            }
            try {
                const res = await fetch("/api/recruit/me");
                const data = await res.json();
                if (!cancelled && data.success) {
                    router.replace("/recruit/dashboard");
                    return;
                }
            } catch {
                // Not logged in as a recruit either — show the chooser.
            }
            if (!cancelled) setCheckingSession(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [router]);

    if (checkingSession) {
        return <div className="min-h-screen" />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative z-10 p-5 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <AuthNav onBack={role ? () => setRole(null) : undefined} />
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
                    <div className="flex justify-center mb-8">
                        <Image
                            src="/LOGO.png"
                            alt="Robocon Logo"
                            width={160}
                            height={160}
                            className="object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            unoptimized
                        />
                    </div>

                    {role === null ? (
                        <RoleChooser onChoose={setRole} />
                    ) : role === "member" ? (
                        <MemberForm />
                    ) : (
                        <RecruitForm />
                    )}
                </div>
            </div>
        </div>
    );
}
