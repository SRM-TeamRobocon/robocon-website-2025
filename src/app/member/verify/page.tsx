"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl text-center">
                    {status === "loading" && <p className="text-gray-300">Verifying your email...</p>}

                    {(status === "success" || status === "already") && (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-3">Email verified</h2>
                            <p className="text-sm text-gray-400">
                                Your email is confirmed. An admin still needs to approve your account before you can log
                                in — you'll be able to sign in once that's done.
                            </p>
                            <Link
                                href="/admin/login"
                                className="mt-6 inline-block rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                            >
                                Go to Login
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
