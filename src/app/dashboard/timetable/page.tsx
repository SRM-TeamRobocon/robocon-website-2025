"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, CalendarOff, PenSquare, Search, User, Users } from "lucide-react";
import { useRoleGate } from "@/hooks/use-require-role";
import WhoIsFreePanel from "@/components/timetable/WhoIsFreePanel";
import DayOrderBanner from "@/components/timetable/DayOrderBanner";

interface TimetableEntry {
    owner_username: string;
    owner_name: string;
    domain: string | null;
    updated_at: string;
}

interface LeaveToday {
    owner_name: string;
    member_accounts: { email: string } | null;
}

const DOMAIN_TABS = ["All", "SAMBED", "SIESED", "SPACED", "MCSOCD"] as const;

export default function TimetableDirectoryPage() {
    const { ready, role } = useRoleGate(["member", "lead", "admin"]);
    const [rows, setRows] = useState<TimetableEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [domainTab, setDomainTab] = useState<(typeof DOMAIN_TABS)[number]>("All");
    const [showFreePanel, setShowFreePanel] = useState(false);
    const [onLeaveEmails, setOnLeaveEmails] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetch("/api/dashboard/timetables")
            .then((res) => res.json())
            .then((data) => setRows(data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));

        // "Approved Busy" indicator — cross-referenced by email (owner_username for
        // member_accounts logins is their login email).
        fetch("/api/dashboard/leave-requests/today")
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) return;
                const emails = (data.data as LeaveToday[])
                    .map((row) => row.member_accounts?.email)
                    .filter((email): email is string => !!email);
                setOnLeaveEmails(new Set(emails));
            })
            .catch(() => {});
    }, []);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rows
            .filter((row) => domainTab === "All" || row.domain === domainTab)
            .filter((row) => !query || row.owner_name.toLowerCase().includes(query))
            .sort((a, b) => a.owner_name.localeCompare(b.owner_name));
    }, [rows, search, domainTab]);

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                        <CalendarClock className="h-6 w-6 shrink-0 text-red sm:h-7 sm:w-7" />
                        Timetable
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-gray-400">
                        Everyone&apos;s class schedule, in one place. Browse a member&apos;s timetable or fill in your own.
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                        onClick={() => setShowFreePanel((v) => !v)}
                        className={`inline-flex w-fit items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition ${
                            showFreePanel
                                ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-inset ring-cyan-500/40"
                                : "bg-cyan-500/10 text-cyan-400 ring-1 ring-inset ring-cyan-500/30 hover:bg-cyan-500/20"
                        }`}
                    >
                        <Users className="h-4 w-4" /> See who&apos;s free
                    </button>
                    <Link
                        href="/dashboard/timetable/me"
                        className="group relative inline-flex w-fit items-center gap-1.5 overflow-hidden bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/40 active:translate-y-0 active:scale-[0.97]"
                        style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                    >
                        <span
                            className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                            style={{
                                clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                                backgroundColor: "#D4AF37",
                            }}
                        />
                        <span className="relative z-10 inline-flex items-center gap-1.5 transition-colors duration-200 group-hover:text-black">
                            <PenSquare className="h-4 w-4" /> My Timetable
                        </span>
                    </Link>
                </div>
            </div>

            <DayOrderBanner canOverride={role === "lead" || role === "admin"} />

            {showFreePanel && <WhoIsFreePanel onClose={() => setShowFreePanel(false)} />}

            <div className="flex flex-wrap gap-2">
                {DOMAIN_TABS.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setDomainTab(tab)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition ${
                            domainTab === tab
                                ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                                : "text-gray-400 hover:bg-white/5"
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="relative max-w-sm">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-red"
                />
            </div>

            {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
            ) : filtered.length === 0 ? (
                <div
                    className="border border-white/10 bg-white/[0.03] p-10 text-center"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    <CalendarClock className="mx-auto mb-3 h-8 w-8 text-gray-700" />
                    <p className="text-sm text-gray-400">No timetables saved yet.</p>
                    <Link
                        href="/dashboard/timetable/me"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-red hover:underline"
                    >
                        <PenSquare className="h-4 w-4" /> Add yours
                    </Link>
                </div>
            ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((row) => (
                        <li key={row.owner_username}>
                            <Link
                                href={`/dashboard/timetable/${encodeURIComponent(row.owner_username)}`}
                                className="flex items-center gap-3 border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
                                style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-white/10 text-gray-400">
                                    <User className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                        <span className="block truncate font-semibold text-white">{row.owner_name}</span>
                                        {onLeaveEmails.has(row.owner_username) && (
                                            <span className="inline-flex shrink-0 items-center gap-1 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-300 ring-1 ring-inset ring-purple-500/30">
                                                <CalendarOff className="h-2.5 w-2.5" /> APPROVED BUSY
                                            </span>
                                        )}
                                    </span>
                                    <span className="block text-xs text-gray-500">
                                        {row.domain ? `${row.domain} · ` : ""}
                                        Updated {new Date(row.updated_at).toLocaleDateString()}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
