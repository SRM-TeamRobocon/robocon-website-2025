"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface Metric {
    total: number;
    pending: number;
    verified: number;
    checkedIn: number;
}

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Metric>({ total: 0, pending: 0, verified: 0, checkedIn: 0 });
    const [username, setUsername] = useState("Admin");

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch User Info
                const userRes = await fetch("/api/admin/me");
                const userData = await userRes.json();
                if (userData.success) {
                    if (userData.user == "spacedlead") {
                        setUsername("SIDDHANT JAIN");
                    }
                    else if (userData.user == "roboconlead") {
                        setUsername("ANUSHREE DATTA");
                    } else if (userData.user == "siesedlead") {
                        setUsername("ASHUTOSH");
                    } else if (userData.user == "mcsocdlead") {
                        setUsername("AGAMJOT KAUR");
                    } else if (userData.user == "sambedlead") {
                        setUsername("NITHYA GURU");
                    } else {
                        setUsername("MEMBER");
                    }
                }

                // Fetch ALL registrations (no event filter)
                const res = await fetch("/api/admin/registrations");
                const json = await res.json();

                if (json.success && json.data) {
                    const data: any[] = json.data;
                    setStats({
                        total: data.length,
                        pending: data.filter(r => r.paymentStatus === 'PENDING').length,
                        verified: data.filter(r => r.paymentStatus === 'VERIFIED').length,
                        checkedIn: data.filter(r => r.attendance === 'PRESENT').length,
                    });
                }
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div>
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">{username}</h1>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold rounded-lg backdrop-blur-sm">
                            SRM Team Robocon 2026
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-300 font-medium">EVENT DASHBOARD</span>
                    </div>
                    <p className="text-gray-400 max-w-xl leading-relaxed">Select an event below to manage participants, verify payments, and check-in attendees.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-center">
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Total Regs</div>
                        <div className="text-2xl font-black text-white">{loading ? '-' : stats.total}</div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                        <div className="text-[10px] text-amber-500 uppercase font-bold tracking-wider mb-1">Pending</div>
                        <div className="text-2xl font-black text-white">{loading ? '-' : stats.pending}</div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                        <div className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider mb-1">Verified</div>
                        <div className="text-2xl font-black text-white">{loading ? '-' : stats.verified}</div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                        <div className="text-[10px] text-blue-500 uppercase font-bold tracking-wider mb-1">Checked In</div>
                        <div className="text-2xl font-black text-white">{loading ? '-' : stats.checkedIn}</div>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Solidworks Banner */}
                {/* Solidworks Banner */}
                <Link href="/admin/dashboard/solidworks" className="group block h-full">
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-rose-600/20 via-rose-900/20 to-gray-900 border border-rose-500/30 p-8 transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(225,29,72,0.2)] h-full flex flex-col">
                        <div className="absolute top-0 right-0 p-6 opacity-30 group-hover:opacity-60 transition-opacity">
                            <svg className="w-24 h-24 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M21 16V8.00003L12 3L3 8.00003V16L12 21L21 16ZM12 5.30005L18.6 9.00003L12 12.7L5.4 9.00003L12 5.30005ZM4.5 10.3L11.2 14.1V21V21.1C11.1 21.1 11.1 21 11.1 21V14.1L4.5 10.3ZM12.8 14.1L19.5 10.3V14.1L12.8 21V14.1Z" />
                            </svg>
                        </div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-full mb-4 ring-1 ring-inset ring-rose-500/30">
                                    <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse" />
                                    Hi-Tech 513
                                </span>
                                <h2 className="text-3xl font-bold text-white mb-2 group-hover:text-rose-400 transition-colors">Solidworks</h2>
                                <p className="text-gray-300 mb-6 drop-shadow-md">Manage 3D CAD modeling workshop participants.</p>
                            </div>

                            <div className="mt-auto flex items-center text-rose-400 font-medium">
                                Manage Participants
                                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Altium Banner */}
                <Link href="/admin/dashboard/altium" className="group block h-full">
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600/20 via-blue-900/20 to-gray-900 border border-blue-500/30 p-8 transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] h-full flex flex-col">
                        <div className="absolute top-0 right-0 p-6 opacity-30 group-hover:opacity-60 transition-opacity">
                            <svg className="w-24 h-24 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                        </div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full mb-4 ring-1 ring-inset ring-blue-500/30">
                                    Location TBD
                                </span>
                                <h2 className="text-3xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Altium</h2>
                                <p className="text-gray-300 mb-6 drop-shadow-md">Manage PCB Designing workshop participants.</p>
                            </div>

                            <div className="mt-auto flex items-center text-blue-400 font-medium">
                                Manage Participants
                                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

        </div>
    );
}
