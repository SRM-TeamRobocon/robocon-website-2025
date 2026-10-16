"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Download, Flame, Radio, Clock, Users, UserCircle2, X, Ghost, Moon, LogIn, LogOut, Search } from "lucide-react";
import {
    calculateStats,
    buildSessions,
    getGhostedAttendanceDays,
    istDateKey,
    normalizeAttendanceDuration,
    generateSessionCSV,
    formatDuration,
    toLocalDatetimeValue,
    type AttendanceEvent,
    type MemberAttendanceStats,
    type AttendanceSession,
    type GhostStat,
} from "@/lib/attendance";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

const REFRESH_MS = 30_000;

interface BroadcastPayload {
    event: "tap" | "linked";
    name: string;
    domain?: string;
    action?: "IN" | "OUT";
}

interface LeaveWindow {
    startTime: string | null;
    endTime: string | null;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const monthKey = (timestamp: number) => new Date(timestamp + IST_OFFSET_MS).toISOString().slice(0, 7);
const monthBounds = (key: string) => {
    const [year, month] = key.split("-").map(Number);
    return {
        start: Date.UTC(year, month - 1, 1) - IST_OFFSET_MS,
        end: Date.UTC(year, month, 1) - IST_OFFSET_MS,
    };
};
const monthLabel = (key: string) => {
    const { start } = monthBounds(key);
    return new Date(start + IST_OFFSET_MS).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
};
const sourceLabel = (source?: string | null) => {
    if (source === "rfid") return "RFID";
    if (source === "manual_correction") return "App correction";
    if (source === "admin_correction") return "Admin edit";
    if (source === "auto_checkout") return "Auto checkout";
    if (source === "carryover") return "Earlier visit";
    return "Unknown source";
};

// null start/end = full-day leave, always "now". Otherwise compares against the
// current IST clock time.
function isWithinLeaveWindow(leave: LeaveWindow, nowMs: number): boolean {
    if (!leave.startTime || !leave.endTime) return true;
    const nowHHMM = new Date(nowMs).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    return nowHHMM >= leave.startTime && nowHHMM <= leave.endTime;
}

function Card({
    children,
    className = "",
    borderClassName = "border-white/10",
}: {
    children: React.ReactNode;
    className?: string;
    borderClassName?: string;
}) {
    return <div className={`border ${borderClassName} bg-black ${className}`}>{children}</div>;
}

function StatTile({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: string }) {
    return (
        <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 sm:text-[11px]">{label}</span>
                <Icon className={`h-4 w-4 ${tone}`} strokeWidth={1.5} />
            </div>
            <div className={`mt-3 text-2xl font-black sm:text-3xl ${tone}`}>{value}</div>
        </Card>
    );
}

export default function AttendanceBoardPage() {
    const [events, setEvents] = useState<AttendanceEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());
    const [selected, setSelected] = useState<MemberAttendanceStats | null>(null);
    const [onLeaveMap, setOnLeaveMap] = useState<Map<string, LeaveWindow>>(new Map());
    const [overnightIds, setOvernightIds] = useState<Set<string>>(new Set());
    const eventsRef = useRef<AttendanceEvent[]>([]);

    // Viewer's own role + card-link status - role gates the admin controls in the member
    // modal below; linked (specifically false, not just falsy) gates the "Link My Card"
    // nav CTA. viewerHasAccount distinguishes "no card linked yet" from "this login has
    // no member_accounts row at all" (e.g. a LEAD_ACCOUNTS-only login) - the latter has
    // nothing to link, so it must not show the CTA.
    const [viewerRole, setViewerRole] = useState<"member" | "lead" | "admin" | null>(null);
    const [viewerHasAccount, setViewerHasAccount] = useState(false);
    const [viewerAccountId, setViewerAccountId] = useState<string | null>(null);
    const [viewerLinked, setViewerLinked] = useState<boolean | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(() => monthKey(Date.now()));
    const [memberSearch, setMemberSearch] = useState("");
    const [domainFilter, setDomainFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    const [correcting, setCorrecting] = useState(false);
    const [showCorrectionForm, setShowCorrectionForm] = useState(false);
    const [correctionType, setCorrectionType] = useState<"checked_in_at" | "checked_out_at">("checked_out_at");
    const [correctionTime, setCorrectionTime] = useState("");
    const [selfCorrectionType, setSelfCorrectionType] = useState<"checked_in_at" | "checked_out_at" | null>(null);

    // Render instantly from client cache if available (<5ms initial load)
    useEffect(() => {
        try {
            const cached = localStorage.getItem('str_attendance_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.events?.length) {
                    setEvents(parsed.events);
                    eventsRef.current = parsed.events;
                    if (parsed.overnight) setOvernightIds(new Set(parsed.overnight));
                    setLoading(false);
                }
            }
        } catch {}
    }, []);

    const fetchEvents = useCallback(async () => {
        try {
            const res = await fetch("/api/attendance");
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to load attendance");
            setEvents(data.events);
            eventsRef.current = data.events;
            setOvernightIds(new Set<string>(data.overnight || []));
            try {
                localStorage.setItem('str_attendance_cache', JSON.stringify({ events: data.events, overnight: data.overnight }));
            } catch {}
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load attendance");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchLeaveToday = useCallback(async () => {
        try {
            const res = await fetch("/api/dashboard/leave-requests/today");
            const data = await res.json();
            if (!data.success) return;
            const map = new Map<string, LeaveWindow>();
            for (const row of data.data as Array<{ member_account_id: string; start_time: string | null; end_time: string | null }>) {
                map.set(row.member_account_id, { startTime: row.start_time, endTime: row.end_time });
            }
            setOnLeaveMap(map);
        } catch {
            // Non-critical - the board still works without leave overlay.
        }
    }, []);

    useEffect(() => {
        fetchEvents();
        fetchLeaveToday();
        const interval = setInterval(fetchEvents, REFRESH_MS);
        const leaveInterval = setInterval(fetchLeaveToday, REFRESH_MS);
        const clock = setInterval(() => setNow(Date.now()), 30_000);
        return () => {
            clearInterval(interval);
            clearInterval(leaveInterval);
            clearInterval(clock);
        };
    }, [fetchEvents, fetchLeaveToday]);

    useEffect(() => {
        fetch("/api/admin/me")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setViewerRole(data.role);
                    setViewerHasAccount(Boolean(data.memberAccountId));
                    setViewerAccountId(data.memberAccountId || null);
                }
            })
            .catch(() => {});
        fetch("/api/member/attendance/me")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setViewerLinked(data.linked);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        setShowCorrectionForm(false);
        setCorrectionTime(toLocalDatetimeValue(new Date()));
    }, [selected?.memberAccountId]);

    const isAdminViewer = viewerRole === "lead" || viewerRole === "admin";

    const runCorrection = async (memberAccountId: string, type: "checked_in_at" | "checked_out_at", time?: string) => {
        setCorrecting(true);
        try {
            const res = await fetch("/api/admin/attendance/correct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memberAccountId, type, ...(time ? { time } : {}) }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Attendance updated.");
                setShowCorrectionForm(false);
                fetchEvents();
            } else {
                toast.error(data.error || "Could not save correction.");
            }
        } catch {
            toast.error("Network error while saving correction.");
        } finally {
            setCorrecting(false);
        }
    };

    const forceCheckout = (memberAccountId: string) => {
        if (!confirm("Check this person out right now?")) return;
        runCorrection(memberAccountId, "checked_out_at");
    };
    const submitAdminCorrection = (memberAccountId: string) => {
        if (!correctionTime) return;
        runCorrection(memberAccountId, correctionType, new Date(correctionTime).toISOString());
    };

    const submitSelfCorrection = async () => {
        if (!correctionTime || !selfCorrectionType) return;
        setCorrecting(true);
        try {
            const res = await fetch("/api/member/attendance/correct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: selfCorrectionType, time: new Date(correctionTime).toISOString() }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Attendance updated.");
                setSelfCorrectionType(null);
                fetchEvents();
            } else {
                toast.error(data.error || "Could not save correction.");
            }
        } catch {
            toast.error("Network error while saving correction.");
        } finally {
            setCorrecting(false);
        }
    };

    // Live updates: the tap route broadcasts here via Supabase Realtime's server-side
    // REST broadcast endpoint (see broadcastAttendanceEvent in src/lib/attendance.ts).
    // The 30s poll above is the safety net if a broadcast is ever missed.
    useEffect(() => {
        const supabase = createPublicSupabaseClient();
        if (!supabase) return;

        const channel = supabase.channel("attendance-live");
        channel
            .on("broadcast", { event: "attendance" }, ({ payload }: { payload: BroadcastPayload }) => {
                if (payload.event === "linked") {
                    toast.success(`🔗 ${payload.name} linked a new RFID card!`);
                } else if (payload.action === "IN") {
                    toast.success(`🤖 ${payload.name} has entered the lab.`);
                } else {
                    toast(`👋 ${payload.name} has left the lab.`, { icon: "🚪" });
                }
                fetchEvents();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchEvents]);

    const stats = useMemo(() => calculateStats(events, now), [events, now]);

    const monthOptions = useMemo(() => {
        const earliest = events.length
            ? monthKey(events.reduce((min, event) => Math.min(min, Date.parse(event.occurredAt)), Number.POSITIVE_INFINITY))
            : monthKey(now);
        const current = monthKey(now);
        const options: string[] = [];
        const { start: first } = monthBounds(earliest);
        const { start: last } = monthBounds(current);
        for (let cursor = first; cursor <= last;) {
            options.push(monthKey(cursor));
            const shifted = new Date(cursor + IST_OFFSET_MS);
            cursor = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1) - IST_OFFSET_MS;
        }
        if (!options.includes(current)) options.push(current);
        return options.reverse();
    }, [events, now]);

    const periodEvents = useMemo(() => {
        if (selectedMonth === "all") return events;
        const { start, end } = monthBounds(selectedMonth);
        const latestBefore = new Map<string, AttendanceEvent>();
        for (const event of events) {
            if (Date.parse(event.occurredAt) >= start) break;
            latestBefore.set(event.memberAccountId, event);
        }
        const carryIns: AttendanceEvent[] = [];
        for (const event of Array.from(latestBefore.values())) {
            if (event.action === "IN") carryIns.push({ ...event, action: "IN", occurredAt: new Date(start).toISOString(), source: "carryover" });
        }
        return [...carryIns, ...events.filter((event) => {
            const timestamp = Date.parse(event.occurredAt);
            return timestamp >= start && timestamp < end;
        })];
    }, [events, selectedMonth]);

    const periodEnd = selectedMonth === "all" ? now : Math.min(now, monthBounds(selectedMonth).end) - 1;
    const periodSessions = useMemo(() => buildSessions(periodEvents, periodEnd), [periodEvents, periodEnd]);
    const periodStreakStats = useMemo(() => {
        if (selectedMonth === "all") return stats;
        const historyThroughPeriod = events.filter((event) => Date.parse(event.occurredAt) <= periodEnd);
        return calculateStats(historyThroughPeriod, periodEnd, events);
    }, [events, periodEnd, selectedMonth, stats]);
    const ghostedAttendanceDays = useMemo(() => getGhostedAttendanceDays(events), [events]);
    const countedPeriodSessions = useMemo(() => periodSessions.filter((session) => {
        const day = istDateKey(Date.parse(session.inAt));
        const memberGhostedDays = ghostedAttendanceDays.get(session.memberAccountId);
        return session.outSource !== "auto_checkout" && !memberGhostedDays?.has(day);
    }), [periodSessions, ghostedAttendanceDays]);
    const periodHoursByMember = useMemo(() => {
        const totals = new Map<string, number>();
        for (const session of countedPeriodSessions) {
            const durationMs = normalizeAttendanceDuration(session.durationMs);
            totals.set(session.memberAccountId, (totals.get(session.memberAccountId) || 0) + durationMs);
        }
        return totals;
    }, [countedPeriodSessions]);
    const displayedStats = useMemo(() => {
        if (selectedMonth === "all") return stats;
        const streaksByMember = new Map(periodStreakStats.map((member) => [member.memberAccountId, member.currentStreak]));
        return stats.map((current) => ({
            ...current,
            totalTimeMs: periodHoursByMember.get(current.memberAccountId) || 0,
            // Use the streak as of this period's end, including attendance from earlier months.
            currentStreak: streaksByMember.get(current.memberAccountId) || 0,
        }));
    }, [stats, periodHoursByMember, periodStreakStats, selectedMonth]);

    const ghosts = useMemo<GhostStat[]>(() => {
        const byMember = new Map<string, GhostStat>();
        const bounds = selectedMonth === "all" ? null : monthBounds(selectedMonth);
        for (const session of buildSessions(events, now)) {
            if (session.outSource !== "auto_checkout" || !session.outAt) continue;
            const ghostDayStart = Date.parse(`${istDateKey(Date.parse(session.inAt))}T00:00:00+05:30`);
            if (bounds && (ghostDayStart < bounds.start || ghostDayStart >= bounds.end)) continue;
            const existing = byMember.get(session.memberAccountId);
            if (existing) {
                existing.count += 1;
                if (Date.parse(session.outAt) > Date.parse(existing.lastAt)) existing.lastAt = session.outAt;
            } else {
                byMember.set(session.memberAccountId, {
                    memberAccountId: session.memberAccountId,
                    name: session.name,
                    domain: session.domain,
                    count: 1,
                    lastAt: session.outAt,
                });
            }
        }
        return Array.from(byMember.values()).sort((a, b) => b.count - a.count || Date.parse(b.lastAt) - Date.parse(a.lastAt));
    }, [events, now, selectedMonth]);

    // Keeps the open modal's status (e.g. IN -> OUT after a force-checkout) live across
    // the 30s poll / realtime broadcast, without needing to close and reopen it.
    useEffect(() => {
        if (!selected) return;
        const fresh = stats.find((s) => s.memberAccountId === selected.memberAccountId);
        if (fresh) setSelected(fresh);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stats]);

    const liveIn = useMemo(() => stats.filter((s) => s.status === "IN").sort((a, b) => a.lastTapMs - b.lastTapMs), [stats]);
    const totalHours = useMemo(() => displayedStats.reduce((sum, s) => sum + s.totalTimeMs, 0), [displayedStats]);
    const topStreak = useMemo(() => Math.max(0, ...displayedStats.map((s) => s.currentStreak)), [displayedStats]);
    const periodMemberCount = selectedMonth === "all" ? stats.length : new Set(periodEvents.map((event) => event.memberAccountId)).size;

    const domainTotals = useMemo(() => {
        const map = new Map<string, { total: number; members: number }>();
        for (const s of displayedStats) {
            const entry = map.get(s.domain) || { total: 0, members: 0 };
            entry.total += s.totalTimeMs;
            entry.members += 1;
            map.set(s.domain, entry);
        }
        return Array.from(map.entries())
            .map(([domain, v]) => ({ domain, ...v }))
            .sort((a, b) => b.total - a.total);
    }, [displayedStats]);

    const leaderboard = useMemo(() => [...displayedStats].sort((a, b) => b.totalTimeMs - a.totalTimeMs), [displayedStats]);
    const domains = useMemo(() => Array.from(new Set(leaderboard.map((member) => member.domain))).sort((a, b) => a.localeCompare(b)), [leaderboard]);
    const filteredLeaderboard = useMemo(() => {
        const query = memberSearch.trim().toLocaleLowerCase();
        return leaderboard.filter((member) => {
            const matchesQuery = !query || member.name.toLocaleLowerCase().includes(query) || member.domain.toLocaleLowerCase().includes(query);
            const matchesDomain = domainFilter === "all" || member.domain === domainFilter;
            const leave = onLeaveMap.get(member.memberAccountId);
            const displayedStatus = leave && isWithinLeaveWindow(leave, now)
                ? "On Leave"
                : member.status === "IN" && overnightIds.has(member.memberAccountId)
                  ? "Overnight"
                  : member.status;
            const matchesStatus = statusFilter === "all" || displayedStatus === statusFilter;
            return matchesQuery && matchesDomain && matchesStatus;
        });
    }, [leaderboard, memberSearch, domainFilter, statusFilter, onLeaveMap, now, overnightIds]);
    const maxDomainTotal = Math.max(1, ...domainTotals.map((d) => d.total));

    const selectedTimelineEvents = useMemo(() => {
        if (!selected) return [];
        const bounds = selectedMonth === "all" ? null : monthBounds(selectedMonth);
        return events
            .filter((event) => {
                if (event.memberAccountId !== selected.memberAccountId) return false;
                if (!bounds) return true;
                const timestamp = Date.parse(event.occurredAt);
                return timestamp >= bounds.start && timestamp < bounds.end;
            })
            .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    }, [events, selected, selectedMonth]);

    const tableSessions = periodSessions;
    const latestSessions = useMemo(() => {
        const map = new Map<string, AttendanceSession>();
        for (const session of tableSessions) if (!map.has(session.memberAccountId)) map.set(session.memberAccountId, session);
        if (selectedMonth !== "all") {
            const allLiveSessions = buildSessions(events, now);
            for (const member of stats.filter((entry) => entry.status === "IN")) {
                const active = allLiveSessions.find((session) => session.memberAccountId === member.memberAccountId && !session.outAt);
                if (active) map.set(member.memberAccountId, active);
            }
        }
        return map;
    }, [tableSessions, selectedMonth, events, now, stats]);

    const viewerStats = stats.find((entry) => entry.memberAccountId === viewerAccountId);
    const viewerStatus = viewerStats?.status ?? "OUT";

    const handleDownload = () => {
        const csv = generateSessionCSV(countedPeriodSessions);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance_${selectedMonth === "all" ? "all-time" : selectedMonth}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red">
                        <Radio className="h-3.5 w-3.5 animate-pulse" /> Live
                    </p>
                    <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">Attendance</h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400 sm:text-base">
                        Who&apos;s in the lab right now, and how the team&apos;s been showing up.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Period
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="border border-white/10 bg-black px-3 py-2 text-xs font-semibold normal-case tracking-normal text-white focus:outline-none"
                        >
                            <option value="all">All time</option>
                            {monthOptions.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
                        </select>
                    </label>
                    <Link
                        href="/dashboard/attendance/me"
                        className={
                            viewerHasAccount && viewerLinked === false
                                ? "flex items-center gap-2 border border-red bg-black px-4 py-2 text-xs font-bold tracking-wider text-red transition hover:bg-red/20"
                                : "flex items-center gap-2 border border-white/10 bg-black px-4 py-2 text-xs font-bold tracking-wider text-white transition hover:bg-white/10"
                        }
                    >
                        <UserCircle2 className="h-4 w-4" /> {viewerHasAccount && viewerLinked === false ? "Link My Card" : "My Card"}
                    </Link>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 border border-white/10 bg-black px-4 py-2 text-xs font-bold tracking-wider text-white transition hover:bg-white/10"
                    >
                        <Download className="h-4 w-4" /> Export CSV
                    </button>
                </div>
            </div>

            {(viewerRole === "member" || viewerHasAccount) && !loading && (
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    {viewerHasAccount ? (
                        <>
                            <div>
                                <p className="text-sm font-semibold text-white">Missed a tap?</p>
                                <p className="mt-0.5 text-xs text-gray-500">
                                    {viewerStatus === "IN" ? `Checked in since ${new Date(viewerStats!.lastTapMs).toLocaleString()}.` : "Forgot to record a tap? Add your arrival time."}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelfCorrectionType(viewerStatus === "IN" ? "checked_out_at" : "checked_in_at");
                                    setCorrectionTime(toLocalDatetimeValue(new Date()));
                                }}
                                className="flex w-fit items-center gap-1.5 border border-white/10 px-4 py-2 text-xs font-bold text-gray-200 transition hover:bg-white/10"
                            >
                                {viewerStatus === "IN" ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                                {viewerStatus === "IN" ? "I left at…" : "I arrived at…"}
                            </button>
                        </>
                    ) : (
                        <div>
                            <p className="text-sm font-semibold text-white">Attendance profile not linked</p>
                            <p className="mt-0.5 text-xs text-gray-500">Ask an admin to link your member account before adding a missed tap.</p>
                        </div>
                    )}
                    {viewerHasAccount && selfCorrectionType && (
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="datetime-local"
                                value={correctionTime}
                                onChange={(e) => setCorrectionTime(e.target.value)}
                                className="border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:outline-none"
                            />
                            <button onClick={() => setSelfCorrectionType(null)} className="px-2 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                            <button
                                onClick={submitSelfCorrection}
                                disabled={correcting || !correctionTime}
                                className="bg-red px-3 py-1.5 text-xs font-bold text-white hover:bg-red/80 transition disabled:opacity-50"
                            >
                                {correcting ? "Saving…" : "Save"}
                            </button>
                        </div>
                    )}
                </Card>
            )}

            {error && (
                <Card borderClassName="border-red/30" className="p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-red">Connection error</p>
                    <p className="mt-1 text-sm text-gray-300">{error}</p>
                </Card>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatTile icon={Users} label="In right now" value={String(liveIn.length)} tone="text-red" />
                <StatTile icon={Clock} label={`Total hours (${selectedMonth === "all" ? "all time" : monthLabel(selectedMonth)})`} value={formatDuration(totalHours)} tone="text-white" />
                <StatTile icon={Flame} label="Top streak" value={`${topStreak}d`} tone="text-amber-400" />
                <StatTile icon={UserCircle2} label="Members tracked" value={String(periodMemberCount)} tone="text-cyan-400" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5 sm:p-6">
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red" />
                        </span>
                        In the lab
                    </h2>
                    {loading ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-12 animate-pulse bg-white/5" />
                            ))}
                        </div>
                    ) : liveIn.length === 0 ? (
                        <p className="text-sm text-gray-500">Nobody&apos;s checked in right now.</p>
                    ) : (
                        <div className="space-y-2">
                            {liveIn.map((m) => (
                                <button
                                    key={m.memberAccountId}
                                    onClick={() => setSelected(m)}
                                    className="flex w-full items-center justify-between border border-white/5 bg-black/20 px-3 py-2.5 text-left transition hover:border-white/20"
                                >
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                                            {m.name}
                                            {overnightIds.has(m.memberAccountId) && (
                                                <Moon className="h-3.5 w-3.5 shrink-0 text-indigo-400" strokeWidth={2} />
                                            )}
                                        </p>
                                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{m.domain}</p>
                                    </div>
                                    <span className="shrink-0 font-mono text-xs text-red">since {new Date(m.lastTapMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </Card>

                <Card className="p-5 sm:p-6">
                    <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">Domain leaderboard</h2>
                    {loading ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-8 animate-pulse bg-white/5" />
                            ))}
                        </div>
                    ) : domainTotals.length === 0 ? (
                        <p className="text-sm text-gray-500">No data yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {domainTotals.map((d) => (
                                <div key={d.domain}>
                                    <div className="mb-1 flex items-center justify-between text-xs">
                                        <span className="font-bold text-gray-300">{d.domain}</span>
                                        <span className="font-mono text-gray-500">
                                            {formatDuration(d.total)} · {d.members} member{d.members === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5">
                                        <div className="h-1.5 bg-red/70" style={{ width: `${(d.total / maxDomainTotal) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            <Card className="p-5 sm:p-6">
                <div className="mb-1 flex items-center gap-2">
                    <Ghost className="h-4 w-4 text-indigo-400" strokeWidth={1.5} />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white">Ghost board</h2>
                </div>
                <p className="mb-4 text-xs text-gray-500">
                    Times the midnight sweep had to check someone out because they walked off without tapping. Nights covered by an
                    overnight pass don&apos;t count. Showing {selectedMonth === "all" ? "all time" : monthLabel(selectedMonth)}.
                </p>
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-10 animate-pulse bg-white/5" />
                        ))}
                    </div>
                ) : ghosts.length === 0 ? (
                    <p className="text-sm text-gray-500">Nobody&apos;s ghosted yet. Clean record.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-gray-500">
                                    <th className="pb-2 font-bold">#</th>
                                    <th className="pb-2 font-bold">Name</th>
                                    <th className="pb-2 font-bold">Domain</th>
                                    <th className="pb-2 font-bold">Ghosted</th>
                                    <th className="pb-2 font-bold">Last time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ghosts.map((g, i) => (
                                    <tr key={g.memberAccountId} className="border-b border-white/5">
                                        <td className="py-2.5 font-mono text-xs text-gray-600">{i + 1}</td>
                                        <td className="py-2.5 font-semibold text-white">
                                            {i === 0 && <span className="mr-1.5">👻</span>}
                                            {g.name}
                                        </td>
                                        <td className="py-2.5 text-gray-400">{g.domain}</td>
                                        <td className="py-2.5 font-mono text-indigo-300">
                                            {g.count}
                                            <span className="text-gray-600">×</span>
                                        </td>
                                        <td className="py-2.5 text-xs text-gray-500">{new Date(g.lastAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card className="p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white">All members</h2>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">In for: current or latest visit · Hours: selected period</p>
                </div>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                    <label className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input
                            type="search"
                            value={memberSearch}
                            onChange={(event) => setMemberSearch(event.target.value)}
                            placeholder="Search members or domains"
                            className="w-full border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-white/30 focus:outline-none"
                        />
                    </label>
                    <label className="flex items-center gap-2 border border-white/10 bg-black/40 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Domain
                        <select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)} className="bg-black py-2 text-xs font-semibold normal-case tracking-normal text-white focus:outline-none">
                            <option value="all">All domains</option>
                            {domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
                        </select>
                    </label>
                    <label className="flex items-center gap-2 border border-white/10 bg-black/40 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Status
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-black py-2 text-xs font-semibold normal-case tracking-normal text-white focus:outline-none">
                            <option value="all">All statuses</option>
                            <option value="IN">In</option>
                            <option value="OUT">Out</option>
                            <option value="On Leave">On leave</option>
                            <option value="Overnight">Overnight</option>
                        </select>
                    </label>
                </div>
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-10 animate-pulse bg-white/5" />
                        ))}
                    </div>
                ) : leaderboard.length === 0 ? (
                    <p className="text-sm text-gray-500">No attendance recorded yet. Taps will show up here.</p>
                ) : filteredLeaderboard.length === 0 ? (
                    <p className="py-4 text-sm text-gray-500">No members match these filters.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[650px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-gray-500">
                                    <th className="pb-2 font-bold">Name</th>
                                    <th className="pb-2 font-bold">In for</th>
                                    <th className="pb-2 font-bold">Domain</th>
                                    <th className="pb-2 font-bold">Status</th>
                                    <th className="pb-2 font-bold">Hours</th>
                                    <th className="pb-2 font-bold">Streak</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLeaderboard.map((m) => {
                                    const leave = onLeaveMap.get(m.memberAccountId);
                                    const onLeaveNow = leave && isWithinLeaveWindow(leave, now);
                                    // Only worth flagging while they're actually in the lab - a pass
                                    // claimed by someone who's already tapped out reads as noise.
                                    const stayingOvernight = m.status === "IN" && overnightIds.has(m.memberAccountId);
                                    return (
                                        <tr
                                            key={m.memberAccountId}
                                            onClick={() => setSelected(m)}
                                            className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03]"
                                        >
                                            <td className="py-2.5 font-semibold text-white">{m.name}</td>
                                            <td className="py-2.5 font-mono text-gray-300">
                                                {latestSessions.get(m.memberAccountId) ? formatDuration(latestSessions.get(m.memberAccountId)!.durationMs) : "—"}
                                            </td>
                                            <td className="py-2.5 text-gray-400">{m.domain}</td>
                                            <td className="py-2.5">
                                                {onLeaveNow ? (
                                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset bg-purple-500/15 text-purple-300 ring-purple-500/30">
                                                        On Leave
                                                    </span>
                                                ) : stayingOvernight ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset bg-indigo-500/15 text-indigo-300 ring-indigo-500/30">
                                                        <Moon className="h-2.5 w-2.5" strokeWidth={2.5} /> Overnight
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                                                            m.status === "IN" ? "bg-red/20 text-red ring-red/30" : "bg-white/5 text-gray-400 ring-white/10"
                                                        }`}
                                                    >
                                                        {m.status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 font-mono text-gray-300">{formatDuration(m.totalTimeMs)}</td>
                                            <td className="py-2.5 text-amber-400">{m.currentStreak > 0 ? `🔥 ${m.currentStreak}` : "-"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {selected && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                    onClick={() => setSelected(null)}
                >
                    <div
                        className="max-h-[80vh] w-full max-w-lg border border-white/10 bg-black"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                            <div>
                                <p className="flex items-center gap-2 text-sm font-bold text-white">
                                    {selected.name}
                                    <span
                                        className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                                            selected.status === "IN"
                                                ? "bg-red/20 text-red ring-red/30"
                                                : "bg-white/5 text-gray-400 ring-white/10"
                                        }`}
                                    >
                                        {selected.status}
                                    </span>
                                </p>
                                <p className="text-[10px] uppercase tracking-widest text-gray-500">{selected.domain}</p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {isAdminViewer && (
                            <div className="border-b border-white/10 bg-amber-500/[0.04] px-5 py-4 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Admin controls</p>
                                <div className="flex flex-wrap gap-2">
                                    {selected.status === "IN" && (
                                        <button
                                            onClick={() => forceCheckout(selected.memberAccountId)}
                                            disabled={correcting}
                                            className="border border-red/40 bg-red/10 px-3 py-1.5 text-xs font-bold text-red hover:bg-red/20 transition disabled:opacity-50"
                                        >
                                            Force checkout now
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowCorrectionForm((v) => !v)}
                                        className="border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/10 transition"
                                    >
                                        {showCorrectionForm ? "Cancel" : "Edit in/out time"}
                                    </button>
                                </div>
                                {showCorrectionForm && (
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <select
                                            value={correctionType}
                                            onChange={(e) => setCorrectionType(e.target.value as "checked_in_at" | "checked_out_at")}
                                            className="border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:outline-none"
                                        >
                                            <option value="checked_in_at">Check-in</option>
                                            <option value="checked_out_at">Check-out</option>
                                        </select>
                                        <input
                                            type="datetime-local"
                                            value={correctionTime}
                                            onChange={(e) => setCorrectionTime(e.target.value)}
                                            className="border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:outline-none"
                                        />
                                        <button
                                            onClick={() => submitAdminCorrection(selected.memberAccountId)}
                                            disabled={correcting || !correctionTime}
                                            className="bg-red px-3 py-1.5 text-xs font-bold text-white hover:bg-red/80 transition disabled:opacity-50"
                                        >
                                            Save
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="max-h-[60vh] overflow-y-auto p-5">
                            {selectedTimelineEvents.length === 0 ? (
                                <p className="text-sm text-gray-500">No taps recorded for this period.</p>
                            ) : (
                                <div className="space-y-2">
                                    {selectedTimelineEvents.map((event, i) => (
                                        <div key={`${event.occurredAt}-${i}`} className="flex items-center justify-between gap-4 border border-white/5 bg-white/[0.02] px-3 py-3 text-xs">
                                            <div>
                                                <p className={`font-bold uppercase tracking-wider ${event.action === "IN" ? "text-emerald-400" : "text-amber-400"}`}>
                                                    {event.action} · {sourceLabel(event.source)}
                                                </p>
                                                <p className="mt-1 text-gray-300">{new Date(event.occurredAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
