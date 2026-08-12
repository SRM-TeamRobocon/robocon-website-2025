"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    Users,
} from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { RECRUIT_SUBDOMAINS, subDomainFullLabel } from "@/lib/recruit-domains";
import { todayInIST } from "@/lib/recruit-dates";
import Select from "@/components/ui/select";

interface TrainingSession {
    id: string;
    session_date: string;
    session_label: string;
    sub_domain: string | null;
    created_at?: string;
}

function domainLabel(subDomain: string | null) {
    return subDomain ? subDomainFullLabel(subDomain) : "All Domains";
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

    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [overallSessions, setOverallSessions] = useState<SessionSummary[]>([]);
    const [overallRecruits, setOverallRecruits] = useState<RecruitOverallRow[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [loadingOverall, setLoadingOverall] = useState(true);

    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [detail, setDetail] = useState<SessionDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [newDate, setNewDate] = useState(todayInIST());
    const [newSubDomain, setNewSubDomain] = useState("");
    const [creating, setCreating] = useState(false);

    const [search, setSearch] = useState("");
    const [markingId, setMarkingId] = useState<string | null>(null);

    const loadSessions = useCallback(async () => {
        setLoadingSessions(true);
        try {
            const res = await fetch("/api/admin/recruitment/training-sessions", { cache: "no-store" });
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
    }, []);

    const loadOverall = useCallback(async () => {
        setLoadingOverall(true);
        try {
            const res = await fetch("/api/admin/recruitment/training-attendance", { cache: "no-store" });
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
    }, []);

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
        loadSessions();
        loadOverall();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedSessionId) loadDetail(selectedSessionId);
        else setDetail(null);
    }, [selectedSessionId, loadDetail]);

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
                body: JSON.stringify({ session_date: newDate, sub_domain: newSubDomain || null }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(
                    data.already_started
                        ? `Attendance already started for ${domainLabel(data.data.sub_domain)} on ${formatDate(data.data.session_date)}`
                        : `Attendance started for ${domainLabel(data.data.sub_domain)}`
                );
                setSelectedSessionId(data.data.id);
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
        setMarkingId(recruitId);
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
                await Promise.all([loadDetail(selectedSessionId), loadOverall()]);
            } else {
                toast.error(data.error || "Could not mark attendance");
            }
        } catch {
            toast.error("Could not mark attendance");
        } finally {
            setMarkingId(null);
        }
    };

    const filteredRecruits = useMemo(() => {
        if (!detail) return { attended: [], pending: [] };
        const query = search.trim().toLowerCase();
        const matches = (row: RecruitSessionRow) =>
            !query || row.name.toLowerCase().includes(query) || row.reg_no.toLowerCase().includes(query);

        return {
            attended: detail.recruits.filter((r) => r.attended && matches(r)),
            pending: detail.recruits.filter((r) => !r.attended && matches(r)),
        };
    }, [detail, search]);

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
                    Choose a domain and start attendance — the day&apos;s session is opened on demand, exactly like a
                    volunteer&apos;s first QR scan of the day. A day with no session for a domain simply isn&apos;t
                    counted against anyone — treat it as a holiday, not an absence.
                </p>
            </div>

            {/* Start attendance */}
            <form
                onSubmit={startAttendance}
                className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
            >
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
                    <CalendarPlus className="h-4 w-4 text-red" /> Start Attendance
                </h2>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1 text-sm font-medium text-gray-300">
                        Domain
                        <div className="mt-2">
                            <Select
                                value={newSubDomain}
                                onChange={setNewSubDomain}
                                options={[
                                    { value: "", label: "All Domains (all-hands)" },
                                    ...RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: subDomainFullLabel(d.key) })),
                                ]}
                                className="bg-white/5 ring-white/10 py-2 px-3"
                            />
                        </div>
                    </label>
                    <label className="block text-sm font-medium text-gray-300 sm:w-48">
                        Date
                        <input
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            required
                            className="mt-2 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-red"
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={creating}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red px-4 py-2 text-sm font-bold text-white transition hover:bg-red/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {creating ? "Starting..." : "Start Attendance"}
                    </button>
                </div>
            </form>

            <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                {/* Sessions list */}
                <section className="h-fit overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
                    <div className="border-b border-white/10 px-4 py-3">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
                            Sessions <span className="text-gray-600">({sessions.length})</span>
                        </h2>
                    </div>
                    <div className="max-h-[60vh] divide-y divide-white/5 overflow-y-auto">
                        {loadingSessions ? (
                            <div className="p-5 text-sm text-gray-500">Loading...</div>
                        ) : sessions.length === 0 ? (
                            <div className="p-5 text-sm text-gray-500">No sessions yet. Create one above.</div>
                        ) : (
                            sessions.map((s) => {
                                const summary = overallSessions.find((o) => o.id === s.id);
                                const isActive = s.id === selectedSessionId;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setSelectedSessionId(s.id)}
                                        className={`block w-full px-4 py-3 text-left transition ${
                                            isActive ? "bg-red/10" : "hover:bg-white/[0.04]"
                                        }`}
                                    >
                                        <p className="truncate text-sm font-semibold text-white">{domainLabel(s.sub_domain)}</p>
                                        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                                            <Clock className="h-3 w-3" /> {formatDate(s.session_date)}
                                            {summary && (
                                                <span className="ml-auto text-gray-400">
                                                    {summary.attended_count}/{summary.total_selected}
                                                </span>
                                            )}
                                        </p>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </section>

                {/* Selected session detail */}
                <section className="space-y-4">
                    {!selectedSessionId ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
                            <CalendarClock className="mx-auto mb-3 h-8 w-8 text-gray-700" />
                            <p className="text-sm text-gray-400">Create or select a session to view attendance.</p>
                        </div>
                    ) : loadingDetail || !detail ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-gray-500">
                            Loading attendance...
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <div>
                                    <p className="text-lg font-bold text-white">{domainLabel(detail.session.sub_domain)}</p>
                                    <p className="text-sm text-gray-400">{formatDate(detail.session.session_date)}</p>
                                </div>
                                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
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

                            <div className="relative max-w-sm">
                                <Search
                                    size={14}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                                />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by name or reg no..."
                                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-red"
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Attended */}
                                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
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
                                                    <div className="shrink-0 text-right">
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
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
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Pending / manual mark */}
                                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
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
                                                    <button
                                                        type="button"
                                                        onClick={() => markPresent(r.recruit_id)}
                                                        disabled={markingId === r.recruit_id}
                                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                        {markingId === r.recruit_id ? "Marking..." : "Mark Present"}
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            </div>

            {/* Overall attendance % per recruit */}
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
                <div className="border-b border-white/10 px-5 py-4">
                    <h2 className="text-lg font-bold text-white">Attendance % Across All Sessions</h2>
                    <p className="mt-1 text-xs text-gray-500">
                        {overallSessions.length} session{overallSessions.length === 1 ? "" : "s"} · selected recruits
                        only, scoped to each recruit&apos;s own domain(s) · a day with no session doesn&apos;t count
                        against anyone
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
                                                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                                                        <div
                                                            className={`h-full rounded-full ${
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
    );
}
