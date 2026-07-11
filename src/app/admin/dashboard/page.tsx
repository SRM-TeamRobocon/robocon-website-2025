"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import {
    Users,
    Clock3,
    ShieldCheck,
    ScanLine,
    Globe2,
    Box,
    Cpu,
    QrCode,
    ArrowUpRight,
    Sparkles,
} from "lucide-react";
import { displayNameForUsername } from "@/lib/admin-users";

interface Metric {
    total: number;
    pending: number;
    verified: number;
    checkedIn: number;
}

const STAT_CARDS = [
    { key: "total", label: "Total Registrations", icon: Users, tone: "text-white", ring: "ring-white/10" },
    { key: "pending", label: "Pending Payment", icon: Clock3, tone: "text-amber-400", ring: "ring-amber-500/30" },
    { key: "verified", label: "Verified", icon: ShieldCheck, tone: "text-emerald-400", ring: "ring-emerald-500/30" },
    { key: "checkedIn", label: "Checked In", icon: ScanLine, tone: "text-blue-400", ring: "ring-blue-500/30" },
] as const;

const QUICK_ACTIONS = [
    {
        href: "/admin/dashboard/content",
        title: "Website Content",
        description: "Manage members, projects, achievements, events, alumni, gallery and messages.",
        icon: Globe2,
        badge: "Supabase CMS",
        accent: "from-gray-700/30 via-gray-900 to-black border-white/10 hover:border-red/50 hover:shadow-[0_0_30px_rgba(220,38,38,0.18)]",
        badgeClass: "bg-red/20 text-red ring-red/30",
        iconClass: "text-red",
        textClass: "group-hover:text-red",
    },
    {
        href: "/admin/dashboard/solidworks",
        title: "Solidworks",
        description: "Manage 3D CAD modeling workshop participants.",
        icon: Box,
        badge: "Hi-Tech 513",
        accent: "from-rose-600/20 via-rose-900/20 to-gray-900 border-rose-500/30 hover:shadow-[0_0_30px_rgba(225,29,72,0.2)]",
        badgeClass: "bg-rose-500/20 text-rose-400 ring-rose-500/30",
        iconClass: "text-rose-400",
        textClass: "group-hover:text-rose-400",
    },
    {
        href: "/admin/dashboard/altium",
        title: "Altium",
        description: "Manage PCB designing workshop participants.",
        icon: Cpu,
        badge: "Location TBD",
        accent: "from-blue-600/20 via-blue-900/20 to-gray-900 border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]",
        badgeClass: "bg-blue-500/20 text-blue-400 ring-blue-500/30",
        iconClass: "text-blue-400",
        textClass: "group-hover:text-blue-400",
    },
    {
        href: "/admin/scanner",
        title: "Scanner",
        description: "Scan attendee QR codes for fast, on-the-spot check-in.",
        icon: QrCode,
        badge: "Live Check-in",
        accent: "from-emerald-600/20 via-emerald-900/20 to-gray-900 border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]",
        badgeClass: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
        iconClass: "text-emerald-400",
        textClass: "group-hover:text-emerald-400",
    },
];

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Metric>({ total: 0, pending: 0, verified: 0, checkedIn: 0 });
    const [displayName, setDisplayName] = useState("Member");
    const [today, setToday] = useState("");

    useEffect(() => {
        setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));

        const fetchDashboardData = async () => {
            try {
                const userRes = await fetch("/api/admin/me");
                const userData = await userRes.json();
                if (userData.success) {
                    setDisplayName(displayNameForUsername(userData.user));
                }

                const res = await fetch("/api/admin/registrations");
                const json = await res.json();

                if (json.success && json.data) {
                    const data: any[] = json.data;
                    setStats({
                        total: data.length,
                        pending: data.filter((r) => r.paymentStatus === "PENDING").length,
                        verified: data.filter((r) => r.paymentStatus === "VERIFIED").length,
                        checkedIn: data.filter((r) => r.attendance === "PRESENT").length,
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
        <div className="space-y-8">
            {/* Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-red mb-1">{today}</p>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        {getGreeting()}, {displayName.split(" ")[0]}
                    </h1>
                    <p className="mt-2 text-gray-400 max-w-xl leading-relaxed text-sm sm:text-base">
                        SRM Team Robocon 2026 event dashboard — manage participants, verify payments, and check in attendees.
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STAT_CARDS.map((card, i) => {
                    const Icon = card.icon;
                    const value = stats[card.key];
                    return (
                        <motion.div
                            key={card.key}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
                            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5 ring-1 ${card.ring} transition-colors`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-500">
                                    {card.label}
                                </span>
                                <Icon className={`w-4 h-4 ${card.tone} opacity-70`} />
                            </div>
                            <div className={`mt-3 text-2xl sm:text-3xl font-black ${card.tone}`}>
                                {loading ? (
                                    <span className="inline-block h-8 w-12 rounded bg-white/5 animate-pulse" />
                                ) : (
                                    <CountUp end={value} duration={1.1} />
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Quick actions */}
            <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">Sections</h2>
                <div className="grid md:grid-cols-2 gap-5">
                    {QUICK_ACTIONS.map((action, i) => {
                        const Icon = action.icon;
                        return (
                            <motion.div
                                key={action.href}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + i * 0.06, duration: 0.35, ease: "easeOut" }}
                            >
                                <Link href={action.href} className="group block h-full">
                                    <div
                                        className={`relative rounded-2xl overflow-hidden bg-gradient-to-br border p-6 sm:p-7 transition-all hover:scale-[1.015] h-full flex flex-col ${action.accent}`}
                                    >
                                        <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                                            <Icon className={`w-20 h-20 ${action.iconClass}`} strokeWidth={1} />
                                        </div>

                                        <div className="relative z-10 flex flex-col h-full">
                                            <span
                                                className={`inline-flex w-fit items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full mb-4 ring-1 ring-inset ${action.badgeClass}`}
                                            >
                                                {action.badge}
                                            </span>
                                            <h3 className={`text-2xl font-bold text-white mb-2 transition-colors ${action.textClass}`}>
                                                {action.title}
                                            </h3>
                                            <p className="text-gray-300 mb-6 text-sm leading-relaxed">{action.description}</p>

                                            <div className={`mt-auto flex items-center text-sm font-medium text-gray-300 ${action.textClass}`}>
                                                Open
                                                <ArrowUpRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Member rollout teaser */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.35, ease: "easeOut" }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
            >
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red/15 text-red shrink-0">
                        <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                        <p className="text-white font-bold text-sm">Built for the whole team</p>
                        <p className="text-gray-400 text-sm mt-0.5 max-w-xl">
                            This hub is rolling out to every Robocon domain — more member tools are on the way.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
