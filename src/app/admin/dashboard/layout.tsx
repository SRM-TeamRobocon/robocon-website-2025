"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Toaster } from "react-hot-toast";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [username, setUsername] = useState("Admin");

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch("/api/admin/me");
                const data = await res.json();
                if (data.success) {
                    if (data.user === "spacedlead") setUsername("SPACED LEAD");
                    else if (data.user === "roboconlead") setUsername("TEAM LEAD");
                    else if (data.user === "siesedlead") setUsername("SIESED LEAD");
                    else if (data.user === "mcsocdlead") setUsername("MCSOCD LEAD");
                    else if (data.user === "sambedlead") setUsername("SAMBED LEAD");
                    else if (data.user === "siesed") setUsername("SIESED");
                    else if (data.user === "mcsocd") setUsername("MCSOCD");
                    else if (data.user === "sambed") setUsername("SAMBED");
                    else if (data.user === "spaced") setUsername("SPACED");
                    else setUsername("MEMBER");
                }
            } catch (e) {
                console.error("Failed to fetch user", e);
            }
        };
        fetchUser();
    }, []);

    return (
        <div className="min-h-screen relative z-10 flex flex-col">
            <Toaster position="top-right" toastOptions={{
                style: {
                    background: '#1f2937',
                    color: '#fff',
                    border: '1px solid #374151',
                },
                success: {
                    iconTheme: {
                        primary: '#10b981',
                        secondary: '#fff',
                    },
                },
                error: {
                    iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                    },
                },
            }} />

            {/* Top Navbar */}
            <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/admin/dashboard" className="flex items-center gap-3">
                                <Image
                                    src="/LOGO.png"
                                    alt="Logo"
                                    width={40}
                                    height={40}
                                    unoptimized
                                    className="rounded"
                                />
                                <span className="text-white font-bold text-lg hidden sm:block">
                                    {username}
                                </span>
                            </Link>
                        </div>

                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin/scanner"
                                className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-500/30 text-emerald-400 font-bold transition-all border border-emerald-500/30"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                Scan
                            </Link>

                            <button
                                onClick={async () => {
                                    try {
                                        document.cookie = "admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                                        window.location.href = "/admin/login";
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }}
                                className="text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-md shadow-red-600/20"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full">
                {children}
            </main>
        </div>
    );
}
