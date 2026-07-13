"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Globe2, Wrench, ClipboardCheck, Sparkles, ArrowUpRight } from "lucide-react";
import { displayNameForUsername } from "@/lib/admin-users";

interface QuickAction {
    href: string;
    title: string;
    description: string;
    icon: React.ElementType;
    badge: string;
    accent: string;
    badgeClass: string;
    iconClass: string;
    textClass: string;
    disabled?: boolean;
}

const STAFF_ACTIONS: QuickAction[] = [
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
        href: "/admin/dashboard/workshops",
        title: "Workshops",
        description: "Registrations, payment verification, and check-in for workshop events.",
        icon: Wrench,
        badge: "Live",
        accent: "from-emerald-600/20 via-emerald-900/20 to-gray-900 border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]",
        badgeClass: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
        iconClass: "text-emerald-400",
        textClass: "group-hover:text-emerald-400",
    },
    {
        href: "/admin/dashboard/recruitments",
        title: "Recruitments",
        description: "Applications, orientation, exam, and interview tracking for new recruits.",
        icon: Sparkles,
        badge: "Coming Soon",
        accent: "from-gray-800/40 via-gray-900 to-black border-white/10",
        badgeClass: "bg-white/10 text-gray-300 ring-white/20",
        iconClass: "text-gray-500",
        textClass: "",
        disabled: true,
    },
];

const LEAD_ACTION: QuickAction = {
    href: "/admin/dashboard/approvals",
    title: "Review & Approvals",
    description: "New member signups, role changes, and member-proposed content.",
    icon: ClipboardCheck,
    badge: "Lead Only",
    accent: "from-blue-600/20 via-blue-900/20 to-gray-900 border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]",
    badgeClass: "bg-blue-500/20 text-blue-400 ring-blue-500/30",
    iconClass: "text-blue-400",
    textClass: "group-hover:text-blue-400",
};

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

export default function AdminDashboard() {
    const [displayName, setDisplayName] = useState("Member");
    const [role, setRole] = useState<string | null>(null);
    const [submissionCounts, setSubmissionCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [loading, setLoading] = useState(true);
    const [today, setToday] = useState("");

    useEffect(() => {
        setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));

        const fetchUser = async () => {
            try {
                const userRes = await fetch("/api/admin/me");
                const userData = await userRes.json();
                if (!userData.success) return;

                setDisplayName(userData.name || displayNameForUsername(userData.user));
                setRole(userData.role || null);

                if (userData.role === "member") {
                    const subRes = await fetch("/api/member/content-edits");
                    const subJson = await subRes.json();
                    if (subJson.success && subJson.data) {
                        const rows: any[] = subJson.data;
                        setSubmissionCounts({
                            pending: rows.filter((r) => r.status === "pending").length,
                            approved: rows.filter((r) => r.status === "approved").length,
                            rejected: rows.filter((r) => r.status === "rejected").length,
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to fetch dashboard user", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, []);

    if (role === "member") {
        return (
            <div className="space-y-8">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-red mb-1">{today}</p>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        {getGreeting()}, {displayName.split(" ")[0]}
                    </h1>
                    <p className="mt-2 text-gray-400 max-w-xl leading-relaxed text-sm sm:text-base">
                        Update your team-page profile or propose new projects/achievements/events — a lead reviews
                        content proposals before they go live.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: "Pending", value: submissionCounts.pending, tone: "text-amber-400" },
                        { label: "Approved", value: submissionCounts.approved, tone: "text-emerald-400" },
                        { label: "Rejected", value: submissionCounts.rejected, tone: "text-red-400" },
                    ].map((card) => (
                        <div
                            key={card.label}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5"
                        >
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-500">
                                {card.label}
                            </span>
                            <div className={`mt-3 text-2xl sm:text-3xl font-black ${card.tone}`}>
                                {loading ? (
                                    <span className="inline-block h-8 w-12 rounded bg-white/5 animate-pulse" />
                                ) : (
                                    card.value
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    <Link href="/admin/dashboard/profile" className="group block">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-red/50 transition-all">
                            <h3 className="text-xl font-bold text-white mb-1">My Profile</h3>
                            <p className="text-gray-400 text-sm">Update your photo, role, and socials on the team page.</p>
                        </div>
                    </Link>
                    <Link href="/admin/dashboard/propose" className="group block">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-red/50 transition-all">
                            <h3 className="text-xl font-bold text-white mb-1">Propose Content</h3>
                            <p className="text-gray-400 text-sm">Suggest a new or updated project, achievement, or event.</p>
                        </div>
                    </Link>
                </div>
            </div>
        );
    }

    const actions = role === "lead" || role === "admin" ? [...STAFF_ACTIONS, LEAD_ACTION] : STAFF_ACTIONS;

    return (
        <div className="space-y-8">
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-red mb-1">{today}</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    {getGreeting()}, {displayName.split(" ")[0]}
                </h1>
                <p className="mt-2 text-gray-400 max-w-xl leading-relaxed text-sm sm:text-base">
                    SRM Team Robocon Hub — everything the team needs, in one place.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
                {actions.map((action, i) => {
                    const Icon = action.icon;
                    const card = (
                        <div
                            className={`relative rounded-2xl overflow-hidden bg-gradient-to-br border p-6 sm:p-7 h-full flex flex-col ${action.accent} ${
                                action.disabled ? "" : "transition-all hover:scale-[1.015]"
                            }`}
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

                                {!action.disabled && (
                                    <div className={`mt-auto flex items-center text-sm font-medium text-gray-300 ${action.textClass}`}>
                                        Open
                                        <ArrowUpRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </div>
                                )}
                            </div>
                        </div>
                    );

                    return (
                        <motion.div
                            key={action.href}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
                        >
                            {action.disabled ? card : (
                                <Link href={action.href} className="group block h-full">
                                    {card}
                                </Link>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
