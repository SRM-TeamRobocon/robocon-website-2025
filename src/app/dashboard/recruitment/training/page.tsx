"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    ArrowLeft,
    CalendarClock,
    CalendarPlus,
    Check,
    Clock,
    PenLine,
    QrCode,
    Search,
    Trash2,
    UserCheck,
    UserMinus,
    Users,
} from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import {
    RECRUIT_SUBDOMAINS,
    isRecruitSubDomain,
    subDomainFullLabel,
    type RecruitSubDomain,
} from "@/lib/recruit-domains";
import { todayInIST } from "@/lib/recruit-dates";
import { phoneSearchTerm } from "@/lib/recruit-validation";
import { GENDERS } from "@/lib/gender";
import Select from "@/components/ui/select";

const GENDER_OPTIONS = [
    { value: "", label: "All genders" },
    ...GENDERS.map((g) => ({ value: g.key, label: g.label })),
];

const TRAINING_DOMAIN_STORAGE_KEY = "recruitment_training_domain";

function readStoredDomain(): RecruitSubDomain {
    // SSR has no window, and the page renders null until useRequireRole resolves anyway,
    // so reading here (instead of only in an effect) can't cause a visible hydration mismatch.
    if (typeof window === "undefined") return RECRUIT_SUBDOMAINS[0].key;
    try {
        const stored = window.localStorage.getItem(TRAINING_DOMAIN_STORAGE_KEY);
        if (stored && isRecruitSubDomain(stored)) return stored;
    } catch {
        // Blocked/private-mode storage - fall through to the default.
    }
    return RECRUIT_SUBDOMAINS[0].key;
}

type Step = "domain" | "session" | "attendance";

const STEPS: { key: Step; label: string }[] = [
    { key: "domain", label: "Choose Domain" },
    { key: "session", label: "Start Session" },
    { key: "attendance", label: "Mark Attendance" },
];

interface TrainingSession {
    id: string;
    session_date: string;
    session_label: string;
    sub_domain: string | null;
    created_at?: string;
}

interface SessionSummary extends TrainingSession {
    attended_count: number;
    total_selected: number;
}

interface RecruitOverallRow {
    recruit_id: string;
    name: string;
    reg_no: string;
    sessions_attended: number;
    total_sessions: number;
    percentage: number;
}

interface RecruitSessionRow {
    recruit_id: string;
    name: string;
    reg_no: string;
    // Filter-only - never rendered in a row. Nullable, so a recruit with no gender on file
    // matches neither option and shows only under "All genders".
    gender: string | null;
    // Search-only - never rendered in a row.
    phone: string | null;
    attended: boolean;
    method: "qr" | "manual" | null;
    marked_by: string | null;
    scanned_at: string | null;
}

interface SessionDetail {
    session: TrainingSession;
    recruits: RecruitSessionRow[];
    attendedCount: number;
    totalSelected: number;
}

interface RemovedRow {
    id: string;
    recruit_id: string;
    name: string;
    reg_no: string;
    removed_by: string;
    removed_at: string;
}

function formatDate(value: string) {
    try {
        return new Date(value).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return value;
    }
}

function formatTime(value: string) {
    try {
        return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
        return value;
    }
}

export default function TrainingAttendancePage() {
    const ready = useRequireRole(["member", "lead", "admin"]);

    const [activeDomain, setActiveDomain] = useState<RecruitSubDomain>(readStoredDomain);

    const [step, setStep] = useState<Step>("domain");
    const didInitStepRef = useRef(false);

    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [overallSessions, setOverallSessions] = useState<SessionSummary[]>([]);
    const [overallRecruits, setOverallRecruits] = useState<RecruitOverallRow[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [loadingOverall, setLoadingOverall] = useState(true);

    const [removed, setRemoved] = useState<RemovedRow[]>([]);
    const [loadingRemoved, setLoadingRemoved] = useState(true);

    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [detail, setDetail] = useState<SessionDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [newDate, setNewDate] = useState(todayInIST());
    const [creating, setCreating] = useState(false);

    const [search, setSearch] = useState("");
    const [genderFilter, setGenderFilter] = useState("");
    const [markingId, setMarkingId] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const loadSessions = useCallback(async () => {
        setLoadingSessions(true);
        try {
            const res = await fetch(
                `/api/admin/recruitment/training-sessions?sub_domain=${encodeURIComponent(activeDomain)}`,
                { cache: "no-store" }
            );
            const data = await res.json();
            if (data.success) {
                const rows: TrainingSession[] = data.data || [];
                setSessions(rows);
                setSelectedSessionId((prev) => {
                    if (prev && rows.some((r) => r.id === prev)) return prev;
                    return rows.length > 0 ? rows[rows.length - 1].id : null;
                });
            } else {
                toast.error(data.error || "Could not load training sessions");
            }
        } catch {
            toast.error("Could not load training sessions");
        } finally {
            setLoadingSessions(false);
        }
    }, [activeDomain]);

    const loadOverall = useCallback(async () => {
        setLoadingOverall(true);
        try {
            const res = await fetch(
                `/api/admin/recruitment/training-attendance?sub_domain=${encodeURIComponent(activeDomain)}`,
                { cache: "no-store" }
            );
            const data = await res.json();
            if (data.success) {
                setOverallSessions(data.sessions || []);
                setOverallRecruits(data.recruits || []);
            } else {
                toast.error(data.error || "Could not load attendance overview");
            }
        } catch {
            toast.error("Could not load attendance overview");
        } finally {
            setLoadingOverall(false);
        }
    }, [activeDomain]);

    const loadRemoved = useCallback(async () => {
        setLoadingRemoved(true);
        try {
            const res = await fetch(
                `/api/admin/recruitment/training-removed?sub_domain=${encodeURIComponent(activeDomain)}`,
                { cache: "no-store" }
            );
            const data = await res.json();
            if (data.success) {
                setRemoved(data.data || []);
            } else {
                toast.error(data.error || "Could not load removed recruits");
            }
        } catch {
            toast.error("Could not load removed recruits");
        } finally {
            setLoadingRemoved(false);
        }
    }, [activeDomain]);

    const loadDetail = useCallback(async (sessionId: string) => {
        setLoadingDetail(true);
        try {
            const res = await fetch(
                `/api/admin/recruitment/training-attendance?session_id=${encodeURIComponent(sessionId)}`,
                { cache: "no-store" }
            );
            const data = await res.json();
            if (data.success) {
                setDetail({
                    session: data.session,
                    recruits: data.recruits || [],
                    attendedCount: data.attendedCount ?? 0,
                    totalSelected: data.totalSelected ?? 0,
                });
            } else {
                toast.error(data.error || "Could not load session attendance");
                setDetail(null);
            }
        } catch {
            toast.error("Could not load session attendance");
            setDetail(null);
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(TRAINING_DOMAIN_STORAGE_KEY, activeDomain);
        } catch {
            // Blocked/private-mode storage - the tab still works, it just won't stick on reload.
        }
        setSelectedSessionId(null);
        loadSessions();
        loadOverall();
        loadRemoved();
    }, [activeDomain, loadSessions, loadOverall, loadRemoved]);

    useEffect(() => {
        if (selectedSessionId) loadDetail(selectedSessionId);
        else setDetail(null);
    }, [selectedSessionId, loadDetail]);

    // Land a returning user (domain + session already resolved from the initial load)
    // straight on the right step instead of forcing a click through steps 1-2 every time.
    // Runs exactly once, after the very first sessions fetch settles - later domain/session
    // changes are navigated explicitly by their own handlers.
    useEffect(() => {
        if (didInitStepRef.current || loadingSessions) return;
        didInitStepRef.current = true;
        setStep(selectedSessionId ? "attendance" : "session");
    }, [loadingSessions, selectedSessionId]);

    const startAttendance = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newDate) {
            toast.error("Pick a date");
            return;
        }
        setCreating(true);
        try {
            const res = await fetch("/api/admin/recruitment/training-sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_date: newDate, sub_domain: activeDomain }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(
                    data.already_started
                        ? `Attendance already started for ${subDomainFullLabel(activeDomain)} on ${formatDate(
                              data.data.session_date
                          )}`
                        : `Attendance started for ${subDomainFullLabel(activeDomain)}`
                );
                setSelectedSessionId(data.data.id);
                setStep("attendance");
                await Promise.all([loadSessions(), loadOverall()]);
            } else {
                toast.error(data.error || "Could not start attendance");
            }
        } catch {
            toast.error("Could not start attendance");
        } finally {
            setCreating(false);
        }
    };

    const markPresent = async (recruitId: string) => {
        if (!selectedSessionId) return;
        const snapshot = detail;
        setMarkingId(recruitId);
        setDetail((prev) => {
            if (!prev) return prev;
            let matched = false;
            const recruits = prev.recruits.map((r) => {
                if (r.recruit_id !== recruitId || r.attended) return r;
                matched = true;
                return {
                    ...r,
                    attended: true,
                    method: "manual" as const,
                    marked_by: "You",
                    scanned_at: new Date().toISOString(),
                };
            });
            return matched ? { ...prev, recruits, attendedCount: prev.attendedCount + 1 } : prev;
        });
        try {
            const res = await fetch("/api/admin/recruitment/training-attendance/manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recruit_id: recruitId, session_id: selectedSessionId }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.status === "already_marked") {
                    toast(`${data.name} was already marked present`, { icon: "ℹ️" });
                } else {
                    toast.success(`${data.name} marked present`);
                }
                // Not awaited on purpose - the optimistic update above is already what the
                // user sees, this just lets the % table catch up in the background.
                loadOverall();
            } else {
                setDetail(snapshot);
                toast.error(data.error || "Could not mark attendance");
            }
        } catch {
            setDetail(snapshot);
            toast.error("Could not mark attendance");
        } finally {
            setMarkingId(null);
        }
    };

    const removeRecruit = async (recruitId: string) => {
        if (!detail) return;
        const target = detail.recruits.find((r) => r.recruit_id === recruitId);
        if (!target) return;
        setRemovingId(recruitId);
        try {
            const res = await fetch("/api/admin/recruitment/training-removed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recruit_id: recruitId, sub_domain: activeDomain }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const wasAttended = target.attended;
                setDetail((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        recruits: prev.recruits.filter((r) => r.recruit_id !== recruitId),
                        attendedCount: wasAttended ? prev.attendedCount - 1 : prev.attendedCount,
                        // The roster itself is smaller now, not just this session's tally.
                        totalSelected: prev.totalSelected - 1,
                    };
                });
                setRemoved((prev) => [
                    {
                        id: data.data.id,
                        recruit_id: data.data.recruit_id,
                        name: target.name,
                        reg_no: target.reg_no,
                        removed_by: data.data.removed_by,
                        removed_at: data.data.removed_at,
                    },
                    ...prev,
                ]);
                toast.success(`${data.name} removed from training`);
            } else {
                toast.error(data.error || "Could not remove recruit");
            }
        } catch {
            toast.error("Could not remove recruit");
        } finally {
            setRemovingId(null);
        }
    };

    const unremoveRecruit = async (row: RemovedRow) => {
        setRemovingId(row.recruit_id);
        try {
            const res = await fetch(`/api/admin/recruitment/training-removed/${row.id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRemoved((prev) => prev.filter((r) => r.id !== row.id));
                toast.success(`${row.name} restored to training`);
                if (selectedSessionId) loadDetail(selectedSessionId);
                loadOverall();
            } else {
                toast.error(data.error || "Could not unremove recruit");
            }
        } catch {
            toast.error("Could not unremove recruit");
        } finally {
            setRemovingId(null);
        }
    };

    const filteredRecruits = useMemo(() => {
        if (!detail) return { attended: [], pending: [] };
        const query = search.trim().toLowerCase();
        // Name/reg_no match the raw term; phone matches a digits-only copy, since numbers are
        // stored bare and a pasted "+91 98765 43210" has to normalize first. Null under 3
        // digits, so a stray digit in a name search can't match hundreds of numbers.
        const phoneQuery = phoneSearchTerm(search);
        const matches = (row: RecruitSessionRow) =>
            !query ||
            row.name.toLowerCase().includes(query) ||
            row.reg_no.toLowerCase().includes(query) ||
            (phoneQuery !== null && (row.phone ?? "").includes(phoneQuery));
        // gender is nullable on recruit_accounts, so a recruit with none on file matches
        // neither option - "All genders" (the empty value) is what keeps them listed.
        const matchesGender = (row: RecruitSessionRow) => !genderFilter || row.gender === genderFilter;

        return {
            attended: detail.recruits.filter((r) => r.attended && matches(r) && matchesGender(r)),
            pending: detail.recruits.filter((r) => !r.attended && matches(r) && matchesGender(r)),
        };
    }, [detail, search, genderFilter]);

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard/recruitment"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" /> Back to Recruitment
            </Link>

            <div>
                <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                    <CalendarClock className="h-6 w-6 shrink-0 text-red sm:h-7 sm:w-7" />
                    Training Sessions
                </h1>
                <p className="mt-2 max-w-xl text-sm text-gray-400">
                    Pick a domain, then start attendance. The day&apos;s session is opened on demand, exactly like a
                    volunteer&apos;s first QR scan of the day. A day with no session for a domain simply isn&apos;t
                    counted against anyone, treat it as a holiday, not an absence.
                </p>
            </div>

            {/* Step navigation */}
            <div className="flex flex-wrap items-center gap-1 border border-white/10 bg-black p-2">
                {STEPS.map((s, i) => {
                    const reachable =
                        s.key === "domain" ||
                        (s.key === "session" && Boolean(activeDomain)) ||
                        (s.key === "attendance" && Boolean(selectedSessionId));
                    const isActive = step === s.key;
                    return (
                        <div key={s.key} className="flex items-center">
                            <button
                                type="button"
                                onClick={() => reachable && setStep(s.key)}
                                disabled={!reachable}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${
                                    isActive
                                        ? "bg-red/10 text-white"
                                        : reachable
                                        ? "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                                        : "cursor-not-allowed text-gray-700"
                                }`}
                            >
                                <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-bold ${
                                        isActive ? "bg-red text-white" : "bg-white/10 text-gray-500"
                                    }`}
                                >
                                    {i + 1}
                                </span>
                                {s.label}
                            </button>
                            {i < STEPS.length - 1 && <span className="px-1 text-gray-700">&middot;</span>}
                        </div>
                    );
                })}
            </div>

            {step === "domain" && (
                <section className="border border-white/10 bg-black p-6">
                    <h2 className="mb-5 text-sm font-bold uppercase tracking-widest text-gray-400">
                        Choose a Domain
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        {RECRUIT_SUBDOMAINS.map((d) => {
                            const isChosen = d.key === activeDomain;
                            return (
                                <button
                                    key={d.key}
                                    type="button"
                                    onClick={() => {
                                        setActiveDomain(d.key);
                                        setStep("session");
                                    }}
                                    className={`border px-6 py-4 text-base font-semibold transition ${
                                        isChosen
                                            ? "border-red/40 bg-red/10 text-white"
                                            : "border-white/10 text-gray-400 hover:bg-white/[0.04] hover:text-white"
                                    }`}
                                >
                                    {subDomainFullLabel(d.key)}
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}

            {step === "session" && (
                <div className="space-y-6">
                    <button
                        type="button"
                        onClick={() => setStep("domain")}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-white"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Domain:{" "}
                        <span className="font-semibold text-white">{subDomainFullLabel(activeDomain)}</span>
                    </button>

                    {/* Start attendance */}
                    <form onSubmit={startAttendance} className="border border-white/10 bg-black p-5">
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
                            <CalendarPlus className="h-4 w-4 text-red" /> Start Attendance
                        </h2>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <label className="block text-sm font-medium text-gray-300 sm:w-48">
                                Date
                                <input
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    required
                                    className="mt-2 block w-full border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-red"
                                />
                            </label>
                            <button
                                type="submit"
                                disabled={creating}
                                className="group relative overflow-hidden inline-flex items-center justify-center bg-red px-8 py-2 text-sm font-bold text-white shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none"
                                style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                            >
                                <span
                                    className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                                    style={{
                                        clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                                        backgroundColor: "#D4AF37",
                                    }}
                                />
                                <span className="relative transition-colors duration-200 group-hover:text-black">
                                    {creating ? "Starting..." : "Start Attendance"}
                                </span>
                            </button>
                        </div>
                    </form>

                    {/* Sessions list */}
                    <section className="border border-white/10 bg-black">
                        <div className="border-b border-white/10 px-4 py-3">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
                                Sessions <span className="text-gray-600">({sessions.length})</span>
                            </h2>
                        </div>
                        {loadingSessions ? (
                            <div className="p-5 text-sm text-gray-500">Loading...</div>
                        ) : sessions.length === 0 ? (
                            <div className="p-5 text-sm text-gray-500">No sessions yet. Create one above.</div>
                        ) : (
                            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                                {sessions.map((s) => {
                                    const summary = overallSessions.find((o) => o.id === s.id);
                                    const isActive = s.id === selectedSessionId;
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedSessionId(s.id);
                                                setStep("attendance");
                                            }}
                                            className={`block border px-4 py-3 text-left transition ${
                                                isActive
                                                    ? "border-red/40 bg-red/10"
                                                    : "border-white/10 hover:bg-white/[0.04]"
                                            }`}
                                        >
                                            <p className="truncate text-sm font-semibold text-white">
                                                {formatDate(s.session_date)}
                                            </p>
                                            {summary && (
                                                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                                                    <Clock className="h-3 w-3" />
                                                    <span className="ml-auto text-gray-400">
                                                        {summary.attended_count}/{summary.total_selected}
                                                    </span>
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {step === "attendance" && (
                <div className="space-y-6">
                    <button
                        type="button"
                        onClick={() => setStep("session")}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-white"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Change session
                    </button>

                    {!selectedSessionId ? (
                        <div className="border border-white/10 bg-black p-10 text-center">
                            <CalendarClock className="mx-auto mb-3 h-8 w-8 text-gray-700" />
                            <p className="text-sm text-gray-400">Create or select a session to view attendance.</p>
                        </div>
                    ) : loadingDetail || !detail ? (
                        <div className="border border-white/10 bg-black p-10 text-center text-sm text-gray-500">
                            Loading attendance...
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-black p-5">
                                <div>
                                    <p className="text-lg font-bold text-white">{formatDate(detail.session.session_date)}</p>
                                    <p className="text-sm text-gray-400">{subDomainFullLabel(activeDomain)}</p>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                                    <UserCheck className="h-4 w-4" />
                                    <span className="font-bold">
                                        {detail.attendedCount}/{detail.totalSelected}
                                    </span>
                                    <span className="text-xs text-emerald-400/80">
                                        (
                                        {detail.totalSelected > 0
                                            ? Math.round((detail.attendedCount / detail.totalSelected) * 100)
                                            : 0}
                                        %)
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative max-w-sm flex-1">
                                    <Search
                                        size={14}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    />
                                    <input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search by name, reg no or phone..."
                                        className="w-full border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-red"
                                    />
                                </div>
                                <div className="w-40">
                                    <Select
                                        value={genderFilter}
                                        onChange={setGenderFilter}
                                        options={GENDER_OPTIONS}
                                        className="bg-white/5 ring-white/10 py-2.5 px-3 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Attended */}
                                <div className="border border-white/10 bg-black">
                                    <div className="border-b border-white/10 px-4 py-3">
                                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                            <Check className="h-4 w-4 text-emerald-400" /> Attended (
                                            {filteredRecruits.attended.length})
                                        </h3>
                                    </div>
                                    <div className="max-h-96 divide-y divide-white/5 overflow-y-auto">
                                        {filteredRecruits.attended.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-500">No one yet.</div>
                                        ) : (
                                            filteredRecruits.attended.map((r) => (
                                                <div key={r.recruit_id} className="flex items-center justify-between gap-3 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-white">{r.name}</p>
                                                        <p className="text-xs text-gray-500">{r.reg_no}</p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <div className="text-right">
                                                            <span
                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                                                                    r.method === "qr"
                                                                        ? "bg-blue-500/10 text-blue-300 ring-blue-500/30"
                                                                        : "bg-amber-500/10 text-amber-300 ring-amber-500/30"
                                                                }`}
                                                            >
                                                                {r.method === "qr" ? (
                                                                    <QrCode className="h-3 w-3" />
                                                                ) : (
                                                                    <PenLine className="h-3 w-3" />
                                                                )}
                                                                {r.method}
                                                            </span>
                                                            <p className="mt-1 text-[11px] text-gray-500">
                                                                {r.marked_by}
                                                                {r.scanned_at ? ` · ${formatTime(r.scanned_at)}` : ""}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRecruit(r.recruit_id)}
                                                            disabled={removingId === r.recruit_id}
                                                            title="Remove from training"
                                                            className="shrink-0 p-1.5 text-gray-500 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <UserMinus className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Pending / manual mark */}
                                <div className="border border-white/10 bg-black">
                                    <div className="border-b border-white/10 px-4 py-3">
                                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                            <Users className="h-4 w-4 text-gray-400" /> Not Marked Yet (
                                            {filteredRecruits.pending.length})
                                        </h3>
                                    </div>
                                    <div className="max-h-96 divide-y divide-white/5 overflow-y-auto">
                                        {filteredRecruits.pending.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-500">Everyone&apos;s marked.</div>
                                        ) : (
                                            filteredRecruits.pending.map((r) => (
                                                <div key={r.recruit_id} className="flex items-center justify-between gap-3 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-white">{r.name}</p>
                                                        <p className="text-xs text-gray-500">{r.reg_no}</p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => markPresent(r.recruit_id)}
                                                            disabled={markingId === r.recruit_id}
                                                            className="inline-flex shrink-0 items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                            {markingId === r.recruit_id ? "Marking..." : "Mark Present"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRecruit(r.recruit_id)}
                                                            disabled={removingId === r.recruit_id}
                                                            title="Remove from training"
                                                            className="shrink-0 p-1.5 text-gray-500 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <UserMinus className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Removed from training */}
                    <section className="border border-white/10 bg-black">
                        <div className="border-b border-white/10 px-5 py-4">
                            <h2 className="text-lg font-bold text-white">Removed from Training</h2>
                            <p className="mt-1 text-xs text-gray-500">
                                Pulled out of {subDomainFullLabel(activeDomain)} training - unremove to bring them back.
                            </p>
                        </div>
                        {loadingRemoved ? (
                            <div className="p-6 text-center text-sm text-gray-500">Loading...</div>
                        ) : removed.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500">No one removed.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 text-left text-xs font-bold uppercase tracking-widest text-gray-500">
                                            <th className="px-5 py-3">Name</th>
                                            <th className="px-5 py-3">Reg No</th>
                                            <th className="px-5 py-3">Removed By</th>
                                            <th className="px-5 py-3">Removed At</th>
                                            <th className="px-5 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {removed.map((row) => (
                                            <tr key={row.id} className="border-b border-white/5 last:border-0">
                                                <td className="px-5 py-3 font-medium text-white">{row.name}</td>
                                                <td className="px-5 py-3 text-gray-300">{row.reg_no}</td>
                                                <td className="px-5 py-3 text-gray-300">{row.removed_by}</td>
                                                <td className="px-5 py-3 text-gray-400">
                                                    {formatDate(row.removed_at)} · {formatTime(row.removed_at)}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => unremoveRecruit(row)}
                                                        disabled={removingId === row.recruit_id}
                                                        className="inline-flex items-center gap-1.5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {removingId === row.recruit_id ? "Restoring..." : "Unremove"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    {/* Overall attendance % per recruit */}
                    <section className="border border-white/10 bg-black">
                        <div className="border-b border-white/10 px-5 py-4">
                            <h2 className="text-lg font-bold text-white">
                                Attendance % - {subDomainFullLabel(activeDomain)}
                            </h2>
                            <p className="mt-1 text-xs text-gray-500">
                                {overallSessions.length} session{overallSessions.length === 1 ? "" : "s"} · selected recruits
                                only · a day with no session doesn&apos;t count against anyone
                            </p>
                        </div>
                        {loadingOverall ? (
                            <div className="p-6 text-center text-sm text-gray-500">Loading...</div>
                        ) : overallRecruits.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500">No selected recruits yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 text-left text-xs font-bold uppercase tracking-widest text-gray-500">
                                            <th className="px-5 py-3">Name</th>
                                            <th className="px-5 py-3">Reg No</th>
                                            <th className="px-5 py-3">Sessions Attended</th>
                                            <th className="px-5 py-3">Attendance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overallRecruits
                                            .slice()
                                            .sort((a, b) => b.percentage - a.percentage)
                                            .map((r) => (
                                                <tr key={r.recruit_id} className="border-b border-white/5 last:border-0">
                                                    <td className="px-5 py-3 font-medium text-white">{r.name}</td>
                                                    <td className="px-5 py-3 text-gray-300">{r.reg_no}</td>
                                                    <td className="px-5 py-3 text-gray-300">
                                                        {r.sessions_attended}/{r.total_sessions}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1.5 w-24 overflow-hidden bg-white/10">
                                                                <div
                                                                    className={`h-full ${
                                                                        r.percentage >= 75
                                                                            ? "bg-emerald-500"
                                                                            : r.percentage >= 50
                                                                            ? "bg-amber-500"
                                                                            : "bg-red-500"
                                                                    }`}
                                                                    style={{ width: `${r.percentage}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-gray-400">{r.percentage}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
