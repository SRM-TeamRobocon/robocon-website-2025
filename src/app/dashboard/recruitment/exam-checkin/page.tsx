"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MonitorCheck, Search, X } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

type DayFilter = "1" | "2" | "all";

const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
    { value: "1", label: "Day 1" },
    { value: "2", label: "Day 2" },
    { value: "all", label: "All" },
];

interface CheckIn {
    recruit_id: string;
    name: string;
    reg_no: string;
    day: number;
    at: string;
}

interface DomainColumn {
    sub_domain: string;
    label: string;
    subsystem: string;
    registered: number;
    checked_in: CheckIn[];
}

const POLL_MS = 5000;

function clockTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ExamCheckInBoardPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);

    const [day, setDay] = useState<DayFilter>("1");
    const [domains, setDomains] = useState<DomainColumn[]>([]);
    const [search, setSearch] = useState("");
    // Only guards the very first paint. Later polls swap the data in silently — a spinner
    // every 5s on a screen people are staring at is worse than a momentarily stale list.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/recruitment/exam-checkin?day=${day}`, { cache: "no-store" });
            const data = await res.json();
            if (res.ok && data.success) {
                setDomains(data.domains);
                setError(null);
            } else {
                setError(data.error || "Could not load check-ins");
            }
        } catch {
            setError("Could not load check-ins");
        } finally {
            setLoading(false);
        }
    }, [day]);

    useEffect(() => {
        if (!ready) return;
        setLoading(true);
        load();
        const interval = setInterval(load, POLL_MS);
        return () => clearInterval(interval);
    }, [ready, load]);

    const term = search.trim().toLowerCase();

    // The search deliberately filters all six columns at once rather than scoping to one
    // domain: "am I checked in?" is the question this board exists to answer, and someone
    // sitting two exams needs to see both answers without knowing which column to look in.
    const filtered = useMemo(
        () =>
            domains.map((d) => ({
                ...d,
                visible: term
                    ? d.checked_in.filter(
                          (c) => c.name.toLowerCase().includes(term) || c.reg_no.toLowerCase().includes(term)
                      )
                    : d.checked_in,
            })),
        [domains, term]
    );

    const totalCheckedIn = domains.reduce((sum, d) => sum + d.checked_in.length, 0);
    const matchCount = filtered.reduce((sum, d) => sum + d.visible.length, 0);
    const dayLabel = day === "all" ? "any exam day" : `Day ${day}`;

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <MonitorCheck className="w-7 h-7 text-red" />
                    Exam Check-In Board
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-2xl">
                    Live list of who has been scanned in for each domain&apos;s written exam, newest first.
                    Show this on a screen at the hall so recruits can confirm their own check-in registered.
                    Refreshes every {POLL_MS / 1000}s.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    {DAY_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setDay(opt.value)}
                            className={`px-4 py-2 text-sm font-semibold transition ${
                                day === opt.value
                                    ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                                    : "text-gray-400 hover:bg-white/5"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="relative flex-1 min-w-[16rem] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Find yourself — name or reg no..."
                        className="w-full border-0 bg-white/5 py-2 pl-9 pr-9 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-white transition"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <span className="text-xs font-mono text-gray-500">
                    {totalCheckedIn} checked in · {dayLabel}
                </span>
            </div>

            {/* A search that matches nobody anywhere IS the answer — say so plainly rather than
                leaving six empty columns for the recruit to interpret. */}
            {term && matchCount === 0 && !loading && (
                <div className="border border-red/40 bg-red/10 px-4 py-3 text-sm text-white">
                    No check-in found for <span className="font-bold">&ldquo;{search.trim()}&rdquo;</span> on {dayLabel}.
                    If that&apos;s you, go to a volunteer and get scanned.
                </div>
            )}

            {error && (
                <div className="border border-white/10 bg-black p-4 text-sm text-red font-semibold">{error}</div>
            )}

            {loading ? (
                <div className="border border-white/10 bg-black p-8 text-center text-gray-500 text-sm">Loading...</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
                    {filtered.map((d) => (
                        <div key={d.sub_domain} className="border border-white/10 bg-black flex flex-col">
                            <div className="border-b border-white/10 px-3 py-2.5">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-bold text-white text-sm">{d.label}</span>
                                    <span className="text-[10px] font-mono uppercase tracking-widest text-gray-600">
                                        {d.subsystem}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs text-gray-500">
                                    <span className="font-mono text-emerald-400">{d.checked_in.length}</span>
                                    {" of "}
                                    <span className="font-mono">{d.registered}</span> checked in
                                    {term && <span className="text-gray-600"> · {d.visible.length} shown</span>}
                                </p>
                            </div>

                            <div className="max-h-[28rem] overflow-y-auto">
                                {d.visible.length === 0 ? (
                                    <p className="px-3 py-4 text-xs text-gray-600">
                                        {term ? "No match here." : "Nobody scanned in yet."}
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-white/5">
                                        {d.visible.map((c) => (
                                            <li key={c.recruit_id} className="px-3 py-2">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-sm text-white truncate">{c.name}</span>
                                                    <span className="text-[10px] font-mono text-gray-500 shrink-0">
                                                        {clockTime(c.at)}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[11px] font-mono text-gray-500">{c.reg_no}</span>
                                                    {/* Only meaningful when both days are merged into one list. */}
                                                    {day === "all" && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                                                            Day {c.day}
                                                        </span>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
