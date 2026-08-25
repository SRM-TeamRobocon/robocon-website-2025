"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Globe2,
    ClipboardCheck,
    Sparkles,
    ArrowUpRight,
    Newspaper,
    PenSquare,
    UserCircle,
    FilePlus2,
    ListChecks,
    CalendarClock,
    Radio,
} from "lucide-react";
import { displayNameForUsername } from "@/lib/admin-users";

type Role = "lead" | "admin" | "member";

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

interface StatCard {
    label: string;
    value: number;
    tone: string;
    href?: string;
}

const CONTENT_ACTION: QuickAction = {
    href: "/dashboard/content",
    title: "Website Content",
    description: "Manage members, projects, achievements, events, alumni, gallery and messages.",
    icon: Globe2,
    badge: "Supabase CMS",
    accent: "from-gray-700/30 via-gray-900 to-black border border-white/10 hover:border-red/50 hover:shadow-[0_0_30px_rgba(220,38,38,0.18)]",
    badgeClass: "bg-red/20 text-red ring-red/30",
    iconClass: "text-red",
    textClass: "group-hover:text-red",
};

const TIMETABLE_ACTION: QuickAction = {
    href: "/dashboard/timetable",
    title: "Timetable",
    description: "Browse everyone's class schedule, or fill in your own.",
    icon: CalendarClock,
    badge: "Everyone",
    accent: "from-cyan-600/20 via-cyan-900/20 to-gray-900 border border-cyan-500/30 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]",
    badgeClass: "bg-cyan-500/20 text-cyan-400 ring-cyan-500/30",
    iconClass: "text-cyan-400",
    textClass: "group-hover:text-cyan-400",
};

const RECRUITMENTS_ACTION: QuickAction = {
    href: "/dashboard/recruitment",
    title: "Recruitments",
    description: "Applications, orientation, exam, shortlisting, interviews, and training for new recruits.",
    icon: Sparkles,
    badge: "Live",
    accent: "from-gray-700/30 via-gray-900 to-black border border-white/10 hover:border-red/50 hover:shadow-[0_0_30px_rgba(220,38,38,0.18)]",
    badgeClass: "bg-red/20 text-red ring-red/30",
    iconClass: "text-red",
    textClass: "group-hover:text-red",
};

const APPROVALS_ACTION: QuickAction = {
    href: "/dashboard/approvals",
    title: "Review & Approvals",
    description: "Member signups, role changes, proposed content, and blog posts awaiting review.",
    icon: ClipboardCheck,
    badge: "Lead Only",
    accent: "from-blue-600/20 via-blue-900/20 to-gray-900 border border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]",
    badgeClass: "bg-blue-500/20 text-blue-400 ring-blue-500/30",
    iconClass: "text-blue-400",
    textClass: "group-hover:text-blue-400",
};

const BLOG_ACTION: QuickAction = {
    href: "/dashboard/blogs",
    title: "Blog",
    description: "Read team stories — public posts and members-only posts in one feed.",
    icon: Newspaper,
    badge: "Everyone",
    accent: "from-amber-600/20 via-amber-900/20 to-gray-900 border border-amber-500/30 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]",
    badgeClass: "bg-amber-500/20 text-amber-400 ring-amber-500/30",
    iconClass: "text-amber-400",
    textClass: "group-hover:text-amber-400",
};

const WRITE_BLOG_ACTION: QuickAction = {
    href: "/dashboard/blogs/new",
    title: "Write a Blog",
    description: "Build a post block by block with a live preview. A lead approves it before it goes live.",
    icon: PenSquare,
    badge: "Everyone",
    accent: "from-purple-600/20 via-purple-900/20 to-gray-900 border border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]",
    badgeClass: "bg-purple-500/20 text-purple-400 ring-purple-500/30",
    iconClass: "text-purple-400",
    textClass: "group-hover:text-purple-400",
};

const PROFILE_ACTION: QuickAction = {
    href: "/dashboard/profile",
    title: "My Profile",
    description: "Update your photo, role, and socials on the public team page.",
    icon: UserCircle,
    badge: "You",
    accent: "from-gray-700/30 via-gray-900 to-black border border-white/10 hover:border-red/50 hover:shadow-[0_0_30px_rgba(220,38,38,0.18)]",
    badgeClass: "bg-red/20 text-red ring-red/30",
    iconClass: "text-red",
    textClass: "group-hover:text-red",
};

const PROPOSE_ACTION: QuickAction = {
    href: "/dashboard/propose",
    title: "Propose Content",
    description: "Suggest a new or updated project, achievement, event, or gallery photo.",
    icon: FilePlus2,
    badge: "Needs Approval",
    accent: "from-emerald-600/20 via-emerald-900/20 to-gray-900 border border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]",
    badgeClass: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
    iconClass: "text-emerald-400",
    textClass: "group-hover:text-emerald-400",
};

const ATTENDANCE_ACTION: QuickAction = {
    href: "/dashboard/attendance",
    title: "Attendance",
    description: "See who's in the lab right now, tap-in streaks, and link your RFID card.",
    icon: Radio,
    badge: "Live",
    accent: "from-rose-600/20 via-rose-900/20 to-gray-900 border border-rose-500/30 hover:shadow-[0_0_30px_rgba(244,63,94,0.2)]",
    badgeClass: "bg-rose-500/20 text-rose-400 ring-rose-500/30",
    iconClass: "text-rose-400",
    textClass: "group-hover:text-rose-400",
};

const SUBMISSIONS_ACTION: QuickAction = {
    href: "/dashboard/my-submissions",
    title: "My Submissions",
    description: "Track the status of everything you have proposed so far.",
    icon: ListChecks,
    badge: "You",
    accent: "from-blue-600/20 via-blue-900/20 to-gray-900 border border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]",
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

async function fetchJson(url: string): Promise<any | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        return json?.success ? json : null;
    } catch {
        return null;
    }
}

function countByStatus(rows: any[] | undefined, status: string) {
    return (rows || []).filter((r) => r.status === status).length;
}

function StatGrid({ cards, loading }: { cards: StatCard[]; loading: boolean }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {cards.map((card) => {
                const body = (
                    <div
                        className="relative h-full border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition hover:border-white/20 sm:p-5"
                    >
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 sm:text-[11px]">
                            {card.label}
                        </span>
                        <div className={`mt-3 text-2xl font-black sm:text-3xl ${card.tone}`}>
                            {loading ? (
                                <span className="inline-block h-7 w-10 animate-pulse bg-white/5 align-middle" />
                            ) : (
                                card.value
                            )}
                        </div>
                    </div>
                );

                return card.href ? (
                    <Link key={card.label} href={card.href} className="block">
                        {body}
                    </Link>
                ) : (
                    <div key={card.label}>{body}</div>
                );
            })}
        </div>
    );
}

function ActionGrid({ actions }: { actions: QuickAction[] }) {
    return (
        <div className="grid gap-5 md:grid-cols-2">
            {actions.map((action, i) => {
                const Icon = action.icon;
                const card = (
                    <div
                        className={`relative flex h-full flex-col bg-gradient-to-br p-6 sm:p-7 ${action.accent} ${
                            action.disabled ? "" : "transition-all hover:scale-[1.015]"
                        }`}
                    >
                        <div className="pointer-events-none absolute right-0 top-0 p-6 opacity-20 transition-opacity group-hover:opacity-40">
                            <Icon className={`h-20 w-20 ${action.iconClass}`} strokeWidth={1} />
                        </div>

                        <div className="relative z-10 flex h-full min-w-0 flex-col">
                            <span
                                className={`mb-4 inline-flex w-fit items-center gap-1.5 px-3 py-1 text-xs font-bold ring-1 ring-inset ${action.badgeClass}`}
                            >
                                {action.badge}
                            </span>
                            <h3 className={`mb-2 break-words pr-12 text-xl font-bold text-white transition-colors sm:text-2xl ${action.textClass}`}>
                                {action.title}
                            </h3>
                            <p className="mb-6 text-sm leading-relaxed text-gray-300">{action.description}</p>

                            {!action.disabled && (
                                <div className={`mt-auto flex items-center text-sm font-medium text-gray-300 ${action.textClass}`}>
                                    Open
                                    <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
                        transition={{ delay: i * 0.05, duration: 0.35, ease: "easeOut" }}
                        className="min-w-0"
                    >
                        {action.disabled ? (
                            card
                        ) : (
                            <Link href={action.href} className="group block h-full">
                                {card}
                            </Link>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}

export default function AdminDashboard() {
    const [displayName, setDisplayName] = useState("Member");
    const [role, setRole] = useState<Role | null>(null);
    const [loading, setLoading] = useState(true);
    const [today, setToday] = useState("");

    // Stat cards temporarily disabled — the counts below drove 2-4 extra sequential
    // API calls on every dashboard load, which is what made the page feel slow to
    // paint. Re-enable by restoring this state + fetch block and the <StatGrid .../>
    // calls in the JSX below (search "STAT CARDS DISABLED").
    // // Member-scoped counts
    // const [myProposals, setMyProposals] = useState({ pending: 0, approved: 0 });
    // const [myBlogs, setMyBlogs] = useState({ pending: 0, approved: 0 });
    // // Staff-scoped counts
    // const [staffQueue, setStaffQueue] = useState({ signups: 0, content: 0, blogs: 0 });
    // const [publishedBlogs, setPublishedBlogs] = useState(0);

    useEffect(() => {
        setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));

        (async () => {
            try {
                const userData = await fetchJson("/api/admin/me");
                if (!userData) return;

                const userRole: Role | null = userData.role || null;
                setDisplayName(userData.name || displayNameForUsername(userData.user));
                setRole(userRole);

                // STAT CARDS DISABLED — see comment above.
                // // Everyone can author blogs, so these two apply to every role.
                // const [ownBlogs, feed] = await Promise.all([
                //     fetchJson("/api/member/blogs"),
                //     fetchJson("/api/dashboard/blogs"),
                // ]);
                //
                // if (ownBlogs) {
                //     setMyBlogs({
                //         pending: countByStatus(ownBlogs.data, "pending"),
                //         approved: countByStatus(ownBlogs.data, "approved"),
                //     });
                // }
                // if (feed) setPublishedBlogs((feed.data || []).length);
                //
                // if (userRole === "member") {
                //     const proposals = await fetchJson("/api/member/content-edits");
                //     if (proposals) {
                //         setMyProposals({
                //             pending: countByStatus(proposals.data, "pending"),
                //             approved: countByStatus(proposals.data, "approved"),
                //         });
                //     }
                // } else if (userRole === "lead" || userRole === "admin") {
                //     const [signups, content, blogs] = await Promise.all([
                //         fetchJson("/api/admin/member-approvals"),
                //         fetchJson("/api/admin/content-edits?status=pending"),
                //         fetchJson("/api/admin/blogs?status=pending"),
                //     ]);
                //     setStaffQueue({
                //         signups: (signups?.pending || []).length,
                //         content: (content?.data || []).length,
                //         blogs: (blogs?.data || []).length,
                //     });
                // }
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const header = (
        <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-red">{today || " "}</p>
            <h1 className="break-words text-2xl font-black tracking-tight text-white sm:text-4xl">
                {getGreeting()}, {displayName.split(" ")[0]}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400 sm:text-base">
                {role === "member"
                    ? "Update your profile, propose content, or write a blog for the team."
                    : "SRM Team Robocon Hub — everything the team needs, in one place."}
            </p>
        </div>
    );

    // Until /api/admin/me resolves we don't know which cards this user may see,
    // so render placeholders instead of a bare, empty page.
    if (loading || !role) {
        return (
            <div className="space-y-8">
                {header}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="relative border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                        >
                            <div className="h-3 w-20 animate-pulse bg-white/5" />
                            <div className="mt-4 h-7 w-10 animate-pulse bg-white/5" />
                        </div>
                    ))}
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="relative h-52 animate-pulse border border-white/10 bg-white/[0.03]"
                        />
                    ))}
                </div>
                {!loading && !role && (
                    <div
                        className="relative border border-red/30 bg-red/10 p-5 text-sm text-gray-200"
                    >
                        Could not load your account.{" "}
                        <Link href="/login" className="font-semibold text-red underline">
                            Sign in again
                        </Link>
                        .
                    </div>
                )}
            </div>
        );
    }
    if (role === "member") {
        // STAT CARDS DISABLED — see comment near the effect above. Was:
        // const cards: StatCard[] = [
        //     { label: "Proposals Pending", value: myProposals.pending, tone: "text-amber-400", href: "/dashboard/my-submissions" },
        //     { label: "Proposals Live", value: myProposals.approved, tone: "text-emerald-400", href: "/dashboard/my-submissions" },
        //     { label: "Blogs Pending", value: myBlogs.pending, tone: "text-amber-400", href: "/dashboard/blogs?tab=mine" },
        //     { label: "Blogs Live", value: myBlogs.approved, tone: "text-emerald-400", href: "/dashboard/blogs?tab=mine" },
        // ];

        return (
            <div className="space-y-8">
                {header}
                {/* <StatGrid cards={cards} loading={loading} /> */}
                <ActionGrid actions={[RECRUITMENTS_ACTION, PROFILE_ACTION, ATTENDANCE_ACTION, PROPOSE_ACTION, BLOG_ACTION, WRITE_BLOG_ACTION, SUBMISSIONS_ACTION, TIMETABLE_ACTION]} />
            </div>
        );
    }

    // STAT CARDS DISABLED — see comment near the effect above. Was:
    // const staffCards: StatCard[] = [
    //     { label: "Pending Signups", value: staffQueue.signups, tone: "text-amber-400", href: "/dashboard/approvals" },
    //     { label: "Pending Content", value: staffQueue.content, tone: "text-amber-400", href: "/dashboard/approvals" },
    //     { label: "Pending Blogs", value: staffQueue.blogs, tone: "text-amber-400", href: "/dashboard/approvals" },
    //     { label: "Published Blogs", value: publishedBlogs, tone: "text-emerald-400", href: "/dashboard/blogs" },
    // ];

    const staffActions =
        role === "lead" || role === "admin"
            ? [RECRUITMENTS_ACTION, CONTENT_ACTION, APPROVALS_ACTION, TIMETABLE_ACTION, ATTENDANCE_ACTION, BLOG_ACTION, WRITE_BLOG_ACTION]
            : [RECRUITMENTS_ACTION, CONTENT_ACTION, TIMETABLE_ACTION, ATTENDANCE_ACTION, BLOG_ACTION, WRITE_BLOG_ACTION];

    return (
        <div className="space-y-8">
            {header}
            {/* {(role === "lead" || role === "admin") && <StatGrid cards={staffCards} loading={loading} />} */}
            <ActionGrid actions={staffActions} />
        </div>
    );
}
