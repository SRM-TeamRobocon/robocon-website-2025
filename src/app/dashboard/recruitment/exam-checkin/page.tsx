"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MonitorCheck, Search, X } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { phoneSearchTerm } from "@/lib/recruit-validation";
import { GENDERS } from "@/lib/gender";

type DayFilter = "1" | "2" | "walkin" | "all";

const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
    { value: "1", label: "Day 1" },
    { value: "2", label: "Day 2" },
    { value: "walkin", label: "Walk-in" },
    { value: "all", label: "All" },
];

type GenderFilter = string;

// "All" first, mirroring the Day pills' trailing "All", except a gender has no natural
// default - the board opens unfiltered.
const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
    { value: "all", label: "All" },
    ...GENDERS.map((g) => ({ value: g.key as GenderFilter, label: g.label })),
];

type YearBucket = "year1" | "year2" | "other";

// Rendered in this order inside every domain column. "other" only appears when a recruit
// somehow has a year that isn't 1 or 2 - never dropped, because they still sat the exam.
const YEAR_SECTIONS: { key: YearBucket; label: string }[] = [
    { key: "year1", label: "Year 1" },
    { key: "year2", label: "Year 2" },
    { key: "other", label: "Other" },
];

interface CheckIn {
    recruit_id: string;
    name: string;
    reg_no: string;
    year: string;
    // FILTER-ONLY - NEVER RENDER THIS. Same rule as `phone` below: the board is projected on
    // a screen at the exam hall, so a recruit's gender must not appear in a row. It exists
    // solely to back the gender pills above the columns. Nullable, so a recruit with no
    // gender on file matches neither pill and is only listed under "All".
    gender: string | null;
    // SEARCH-ONLY - NEVER RENDER THIS. The board is projected on a screen at the exam hall
    // in front of the whole queue; a recruit's phone number must not appear in a row. It
    // exists solely so someone can find themselves by typing their own number.
    phone: string | null;
    day: number | null;
    is_walkin: boolean;
    at: string;
}

interface DomainColumn {
    sub_domain: string;
    label: string;
    subsystem: string;
    registered: Record<YearBucket, number> & { total: number };
    checked_in: Record<YearBucket, CheckIn[]>;
    total_checked_in: number;
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
    const [gender, setGender] = useState<GenderFilter>("all");
    const [domains, setDomains] = useState<DomainColumn[]>([]);
    const [search, setSearch] = useState("");
    // Only guards the very first paint. Later polls swap the data in silently - a spinner
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
    // Name/reg_no match the raw term; phone matches a digits-only copy, since numbers are
    // stored bare and someone typing "+91 98765 43210" still has to find "9876543210".
    // Null under 3 digits, so a stray digit in a name search can't match every phone.
    const phoneTerm = phoneSearchTerm(search);

    // True when anything is narrowing the lists - drives the "N shown" counts and the empty
    // -section copy below. With gender on "All" this is exactly `term`, as it always was.
    const filtering = Boolean(term) || gender !== "all";

    // The search deliberately filters all six columns (and both year sections) at once rather
    // than scoping to one: "am I checked in?" is the question this board exists to answer, and
    // someone sitting two exams needs both answers without knowing where to look.
    const filtered = useMemo(() => {
        const matchesSearch = (c: CheckIn) =>
            !term ||
            c.name.toLowerCase().includes(term) ||
            c.reg_no.toLowerCase().includes(term) ||
            (phoneTerm !== null && (c.phone ?? "").includes(phoneTerm));
        // gender is nullable on recruit_accounts, so a recruit with none on file matches
        // neither specific pill - "All" is what keeps them on the board. FILTER-ONLY: the
        // value itself is never rendered in a row (see the CheckIn type).
        const matchesGender = (c: CheckIn) => gender === "all" || c.gender === gender;
        const match = (c: CheckIn) => matchesSearch(c) && matchesGender(c);
        return domains.map((d) => ({
            ...d,
            visible: {
                year1: filtering ? d.checked_in.year1.filter(match) : d.checked_in.year1,
                year2: filtering ? d.checked_in.year2.filter(match) : d.checked_in.year2,
                other: filtering ? d.checked_in.other.filter(match) : d.checked_in.other,
            } as Record<YearBucket, CheckIn[]>,
        }));
    }, [domains, term, phoneTerm, gender, filtering]);

    const totalCheckedIn = domains.reduce((sum, d) => sum + d.total_checked_in, 0);
    const matchCount = filtered.reduce(
        (sum, d) => sum + d.visible.year1.length + d.visible.year2.length + d.visible.other.length,
        0
    );
    const yearTotals = domains.reduce(
        (acc, d) => ({
            year1: acc.year1 + d.checked_in.year1.length,
            year2: acc.year2 + d.checked_in.year2.length,
        }),
        { year1: 0, year2: 0 }
    );
    const dayLabel = day === "all" ? "any exam day" : day === "walkin" ? "walk-in exams" : `Day ${day}`;

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <MonitorCheck className="w-7 h-7 text-red" />
                    Exam Check-In Board
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-2xl">
                    Live list of who has been scanned in for each domain&apos;s written exam, split by year,
                    newest first. Show this on a screen at the hall so recruits can confirm their own
                    check-in registered. Refreshes every {POLL_MS / 1000}s.
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

                {/* Filters only - a recruit's gender is never printed in a row on this board. */}
                <div className="flex items-center gap-2">
                    {GENDER_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setGender(opt.value)}
                            className={`px-4 py-2 text-sm font-semibold transition ${
                                gender === opt.value
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
                        placeholder="Find yourself - name, reg no or phone..."
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
                    {totalCheckedIn} checked in
                    <span className="text-gray-600">
                        {" "}
                        (Y1 {yearTotals.year1} · Y2 {yearTotals.year2})
                    </span>{" "}
                    · {dayLabel}
                </span>
            </div>

            {/* A search that matches nobody anywhere IS the answer - say so plainly rather than
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
                                    <span className="font-mono text-emerald-400">{d.total_checked_in}</span>
                                    {" of "}
                                    <span className="font-mono">{d.registered.total}</span> checked in
                                </p>
                            </div>

                            <div className="max-h-[28rem] overflow-y-auto">
                                {YEAR_SECTIONS.map((section) => {
                                    const rows = d.visible[section.key];
                                    const scanned = d.checked_in[section.key].length;
                                    const registered = d.registered[section.key];

                                    // Skip the "Other" section entirely unless it has someone in
                                    // it - it's a data-quality escape hatch, not a real year.
                                    if (section.key === "other" && scanned === 0 && registered === 0) return null;

                                    return (
                                        <div key={section.key}>
                                            <div className="sticky top-0 z-10 flex items-baseline justify-between gap-2 bg-white/[0.04] px-3 py-1.5 backdrop-blur-sm">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                                    {section.label}
                                                </span>
                                                <span className="text-[10px] font-mono text-gray-500">
                                                    <span className="text-emerald-400">{scanned}</span> of {registered}
                                                    {filtering && <span className="text-gray-600"> · {rows.length} shown</span>}
                                                </span>
                                            </div>

                                            {rows.length === 0 ? (
                                                <p className="px-3 py-2.5 text-xs text-gray-600">
                                                    {filtering ? "No match here." : "Nobody scanned in yet."}
                                                </p>
                                            ) : (
                                                <ul className="divide-y divide-white/5">
                                                    {rows.map((c) => (
                                                        <li key={c.recruit_id} className="px-3 py-2">
                                                            <div className="flex items-baseline justify-between gap-2">
                                                                <span className="text-sm text-white truncate">{c.name}</span>
                                                                <span className="text-[10px] font-mono text-gray-500 shrink-0">
                                                                    {clockTime(c.at)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-[11px] font-mono text-gray-500">
                                                                    {c.reg_no}
                                                                </span>
                                                                {/* Only meaningful when both days (and walk-ins) are merged into one list. */}
                                                                {day === "all" && (
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                                                                        {c.is_walkin ? "Walk-in" : `Day ${c.day}`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
