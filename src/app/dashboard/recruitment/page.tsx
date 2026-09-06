"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    LayoutDashboard,
    CalendarRange,
    Users,
    ClipboardList,
    SlidersHorizontal,
    ListChecks,
    Mic2,
    GraduationCap,
    BarChart3,
    AlertTriangle,
    QrCode,
    ArrowUpRight,
    Ticket,
    BookOpen,
    Mail,
    HelpCircle,
    MonitorCheck,
} from "lucide-react";
import { useRoleGate } from "@/hooks/use-require-role";
import { subDomainLabel, subDomainSubsystem } from "@/lib/recruit-domains";

interface FunnelCounts {
    registered: number;
    orientation: number;
    exam_attended: number;
    shortlisted: number;
    interviewed: number;
    selected: number;
}

interface DomainStats extends FunnelCounts {
    sub_domain: string;
}

interface AnalyticsData {
    cycle: { id: string; name: string; year: string };
    overall: FunnelCounts;
    by_domain: DomainStats[];
}

// `leadOnly` marks the sections whose own pages redirect anyone below lead. Members do
// get the rest of recruitment (roster, marks, interview day, training, analytics) - see
// the matching role lists on each page and API route.
const SECTIONS = [
    { label: "Cycles", href: "/dashboard/recruitment/cycles", icon: CalendarRange, desc: "Create and manage recruitment seasons", leadOnly: true },
    { label: "Recruits", href: "/dashboard/recruitment/recruits", icon: Users, desc: "Full roster for the active cycle", leadOnly: false },
    //{ label: "Exam Check-In", href: "/dashboard/recruitment/exam-checkin", icon: MonitorCheck, desc: "Live board of who's scanned in, domain by domain", leadOnly: false },
    { label: "Marks", href: "/dashboard/recruitment/marks", icon: ClipboardList, desc: "Enter exam marks per domain", leadOnly: false },
    { label: "Cutoffs", href: "/dashboard/recruitment/cutoffs", icon: SlidersHorizontal, desc: "Set cutoffs and run auto-shortlist", leadOnly: true },
    { label: "Shortlist", href: "/dashboard/recruitment/shortlist", icon: ListChecks, desc: "Review and override shortlist status", leadOnly: true },
    { label: "Interview", href: "/dashboard/recruitment/interview", icon: Mic2, desc: "Panels, live queue, and results", leadOnly: false },
    { label: "Send Mail", href: "/dashboard/recruitment/send-mail", icon: Mail, desc: "Email selected recruits, with an optional date & time", leadOnly: true },
    { label: "Training", href: "/dashboard/recruitment/training", icon: GraduationCap, desc: "Sessions and attendance", leadOnly: false },
    { label: "Analytics", href: "/dashboard/recruitment/analytics", icon: BarChart3, desc: "Full funnel breakdown", leadOnly: false },
    { label: "Tickets", href: "/dashboard/recruitment/tickets", icon: Ticket, desc: "Domain change and general requests from recruits", leadOnly: false },
    { label: "Knowledge Base", href: "/dashboard/recruitment/knowledge-base", icon: BookOpen, desc: "Upload .txt files for the recruit chatbot", leadOnly: true },
    // FAQ itself lives in the generic content CMS (src/lib/content-resources.ts), not under
    // /dashboard/recruitment - it's just linked from here too since it's recruit-facing
    // content (shown in FaqSection on /recruit/dashboard) and belongs alongside the rest of
    // the recruitment admin surface.
    { label: "FAQ", href: "/dashboard/content/faq", icon: HelpCircle, desc: "Manage the FAQ shown on the recruit dashboard", leadOnly: true },
];

const STAT_CARDS: { key: keyof FunnelCounts; label: string }[] = [
    { key: "registered", label: "Registered" },
    { key: "orientation", label: "Orientation" },
    { key: "exam_attended", label: "Exam Attended" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "interviewed", label: "Interviewed" },
    { key: "selected", label: "Selected" },
];

export default function RecruitmentOverviewPage() {
    const { ready, role } = useRoleGate(["member", "lead", "admin"]);
    const isLead = role === "lead" || role === "admin";
    const sections = SECTIONS.filter((s) => isLead || !s.leadOnly);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!ready) return;
        fetch("/api/admin/recruitment/analytics")
            .then((res) => res.json())
            .then((d) => {
                if (d.success) setData(d);
                else setError(d.error || "No active recruitment cycle");
            })
            .catch(() => setError("Could not load recruitment data"))
            .finally(() => setLoading(false));
    }, [ready]);

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <LayoutDashboard className="w-7 h-7 text-red" />
                    Recruitment
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Run the junior recruitment pipeline - cycles, registrations, exams, shortlisting, interviews, and training.
                </p>
            </div>

            {loading ? (
                <div className="border border-red bg-black p-8 text-center text-gray-500 text-sm">
                    Loading...
                </div>
            ) : error || !data ? (
                <div className="border border-red bg-black p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                    <p>{error || "No active recruitment cycle."}</p>
                    {/* Only leads can open a cycle - pointing a member at /cycles would just
                        bounce them straight back here. */}
                    {isLead ? (
                        <Link
                            href="/dashboard/recruitment/cycles"
                            className="inline-flex items-center gap-1.5 bg-red/15 text-white ring-1 ring-inset ring-red/40 px-4 py-2 text-sm font-semibold hover:bg-red/25 transition"
                        >
                            Go to Cycles
                        </Link>
                    ) : (
                        <p className="text-xs text-gray-500">Ask a lead to activate a recruitment cycle.</p>
                    )}
                </div>
            ) : (
                <>
                    <div className="border border-red bg-black p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Active Cycle</p>
                        <p className="text-xl font-bold text-white">
                            {data.cycle.name} <span className="text-gray-500 font-normal">({data.cycle.year})</span>
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {STAT_CARDS.map((stat) => (
                            <div key={stat.key} className="border border-red bg-black p-4">
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{stat.label}</p>
                                <p className="text-2xl font-black text-white">{data.overall[stat.key]}</p>
                            </div>
                        ))}
                    </div>

                    <div className="border border-red bg-black p-6">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Domain-wise Registration</p>
                            <Link
                                href="/dashboard/recruitment/analytics"
                                className="text-xs font-semibold text-red hover:text-red/80 inline-flex items-center gap-1"
                            >
                                Full breakdown <ArrowUpRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {[...data.by_domain]
                                .sort((a, b) => b.registered - a.registered)
                                .map((row) => {
                                    const pct =
                                        data.overall.registered > 0
                                            ? Math.round((row.registered / data.overall.registered) * 100)
                                            : 0;
                                    return (
                                        <div key={row.sub_domain}>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-gray-300 font-semibold">
                                                    {subDomainLabel(row.sub_domain)}
                                                    <span className="ml-1.5 text-gray-500 font-normal">
                                                        {subDomainSubsystem(row.sub_domain)}
                                                    </span>
                                                </span>
                                                <span className="text-white font-bold">
                                                    {row.registered} <span className="text-gray-500 font-normal">({pct}%)</span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-white/5 overflow-hidden">
                                                <div className="h-full bg-red transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </>
            )}

            <Link href="/recruit-scanner" className="group block">
                <div className="relative border border-red bg-black p-6 sm:p-7 transition-all hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(194,0,0,0.25)]">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                        <QrCode className="w-20 h-20 text-emerald-400" strokeWidth={1} />
                    </div>
                    <div className="relative z-10">
                        <span className="inline-flex w-fit items-center gap-1.5 px-3 py-1 text-xs font-bold mb-4 ring-1 ring-inset bg-emerald-500/20 text-emerald-400 ring-emerald-500/30">
                            Volunteers
                        </span>
                        <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">Recruitment Scanner</h3>
                        <p className="text-gray-300 mb-6 text-sm leading-relaxed">
                            Scan recruit QR codes to mark attendance. Pick a mode before scanning - Orientation, Exam Day 1,
                            Exam Day 2, Interview Check-In, or Training.
                        </p>
                        <div className="flex items-center text-sm font-medium text-gray-300 group-hover:text-emerald-400">
                            Open Scanner
                            <ArrowUpRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                    </div>
                </div>
            </Link>

            <div>
                <h2 className="text-lg font-bold text-white mb-3">Sections</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        return (
                            <Link
                                key={section.href}
                                href={section.href}
                                className="block border border-red bg-black p-5 hover:bg-red/10 transition group"
                            >
                                <Icon className="w-6 h-6 text-red mb-3" />
                                <p className="font-bold text-white group-hover:text-red transition">{section.label}</p>
                                <p className="mt-1 text-xs text-gray-500">{section.desc}</p>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
