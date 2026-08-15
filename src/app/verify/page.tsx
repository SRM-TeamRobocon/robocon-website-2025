"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthNav from "@/components/AuthNav";

type Status = "loading" | "success" | "already" | "error";

function VerifyContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [status, setStatus] = useState<Status>("loading");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setError("Missing verification token.");
            return;
        }

        fetch("/api/member/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        })
            .then(async (res) => {
                const data = await res.json();
                if (res.ok && data.success) {
                    setStatus(data.alreadyVerified ? "already" : "success");
                } else {
                    setStatus("error");
                    setError(data.error || "Verification failed.");
                }
            })
            .catch(() => {
                setStatus("error");
                setError("An unexpected error occurred.");
            });
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center relative z-10 p-5">
            <div className="w-full max-w-md relative z-10">
                <AuthNav />
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 p-8 shadow-2xl text-center">
                    {status === "loading" && <p className="text-gray-300">Verifying your email...</p>}

                    {(status === "success" || status === "already") && (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-3">Email verified</h2>
                            <p className="text-sm text-gray-400">
                                Your email is confirmed. An admin still needs to approve your account before you can log
                                in — you'll be able to sign in once that's done.
                            </p>
                            <Link
                                href="/login"
                                className="group relative mt-6 inline-flex items-center justify-center overflow-hidden bg-red px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97]"
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
                                    Go to Login
                                </span>
                            </Link>
                        </>
                    )}

                    {status === "error" && (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-3">Verification failed</h2>
                            <p className="text-sm text-red">{error}</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MemberVerify() {
    return (
        <Suspense fallback={<div className="min-h-screen" />}>
            <VerifyContent />
        </Suspense>
    );
}
