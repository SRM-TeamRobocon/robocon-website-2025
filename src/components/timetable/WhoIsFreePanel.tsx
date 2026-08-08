"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import {
    DAYS,
    TIME_SLOTS,
    TIME_BOUNDARIES,
    LOCATION_OPTIONS,
    formatMinutes,
    isLocatedStatus,
    slotsInRange,
    snapToBoundary,
    parseFreeTextQuery,
    type TimetableSchedule,
} from "@/lib/timetable";

interface RosterMember {
    username: string;
    name: string;
    domain: string | null;
    role: string;
}

interface LocationBucket<T> {
    key: string;
    label: string;
    items: T[];
}

// Buckets Class/Lab members by location, in LOCATION_OPTIONS order, with anyone whose
// location isn't set (or, for the "whole window" view, varies slot-to-slot) trailing last.
function groupByLocation<T extends { location: string | null }>(items: T[]): LocationBucket<T>[] {
    const buckets: Record<string, T[]> = {};
    items.forEach((item) => {
        const key = item.location || "";
        (buckets[key] ||= []).push(item);
    });
    const ordered: LocationBucket<T>[] = LOCATION_OPTIONS.filter((loc) => buckets[loc.value]?.length).map((loc) => ({
        key: loc.value,
        label: loc.label,
        items: buckets[loc.value],
    }));
    if (buckets[""]?.length) {
        ordered.push({ key: "", label: "No location set", items: buckets[""] });
    }
    return ordered;
}

const STATUS_KEYS = ["", "class", "lab", "online"] as const;
const STATUS_LABELS: Record<string, string> = { "": "Free", class: "Class", lab: "Lab", online: "Online" };
const STATUS_STYLES: Record<string, string> = {
    "": "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    class: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    lab: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    online: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
};

export default function WhoIsFreePanel({ onClose }: { onClose: () => void }) {
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<RosterMember[]>([]);
    const [schedules, setSchedules] = useState<Record<string, TimetableSchedule>>({});

    const [dayIndex, setDayIndex] = useState(0);
    const [startMin, setStartMin] = useState(TIME_BOUNDARIES[0]);
    const [endMin, setEndMin] = useState(TIME_BOUNDARIES[TIME_BOUNDARIES.length - 1]);
    const [domain, setDomain] = useState("All");
    const [query, setQuery] = useState("");
    const [queryError, setQueryError] = useState("");

    useEffect(() => {
        fetch("/api/dashboard/timetables/status")
            .then((res) => res.json())
            .then((json) => {
                if (json.success) {
                    setMembers(json.members || []);
                    setSchedules(json.schedules || {});
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const domains = useMemo(() => {
        const set = new Set<string>();
        members.forEach((m) => m.domain && set.add(m.domain));
        return ["All", ...Array.from(set).sort()];
    }, [members]);

    const runTextSearch = () => {
        if (!query.trim()) return;
        const parsed = parseFreeTextQuery(query);
        if (parsed.dayIndex === null && parsed.startMin === null) {
            setQueryError('Could not understand that — try something like "do1 1pm to 3pm", or use the filters below.');
            return;
        }
        setQueryError("");
        if (parsed.dayIndex !== null) setDayIndex(parsed.dayIndex);
        if (parsed.startMin !== null && parsed.endMin !== null) {
            // The From/To dropdowns only offer slot-boundary values, so an arbitrary
            // parsed time (e.g. "1pm") has to snap to one to be displayable at all.
            setStartMin(snapToBoundary(parsed.startMin, "down"));
            setEndMin(snapToBoundary(parsed.endMin, "up"));
        }
    };

    const day = DAYS[dayIndex];
    const overlappingSlots = useMemo(() => slotsInRange(startMin, endMin), [startMin, endMin]);
    const filteredMembers = useMemo(
        () => members.filter((m) => domain === "All" || m.domain === domain),
        [members, domain]
    );
    const noData = useMemo(
        () => filteredMembers.filter((m) => !schedules[m.username]),
        [filteredMembers, schedules]
    );
    // Free for the ENTIRE window, not just some slot within it — free in every
    // overlapping slot, not merely one of them.
    const fullyFree = useMemo(() => {
        if (overlappingSlots.length === 0) return [];
        return filteredMembers.filter((m) => {
            const schedule = schedules[m.username];
            if (!schedule) return false;
            return overlappingSlots.every((slotIndex) => (schedule[day]?.[slotIndex]?.status || "") === "");
        });
    }, [filteredMembers, schedules, overlappingSlots, day]);

    // In Class or Lab for the ENTIRE window (never free/online within it), grouped by
    // location — only when that location is the same across every overlapping slot;
    // otherwise they land in the trailing "No location set" bucket.
    const fullyBusy = useMemo(() => {
        if (overlappingSlots.length === 0) return [];
        return filteredMembers.filter((m) => {
            const schedule = schedules[m.username];
            if (!schedule) return false;
            return overlappingSlots.every((slotIndex) => isLocatedStatus(schedule[day]?.[slotIndex]?.status || ""));
        });
    }, [filteredMembers, schedules, overlappingSlots, day]);

    const fullyBusyGroups = useMemo(() => {
        const withLocation = fullyBusy.map((m) => {
            const schedule = schedules[m.username]!;
            const locations = new Set(overlappingSlots.map((slotIndex) => schedule[day]?.[slotIndex]?.location || ""));
            const location = locations.size === 1 ? Array.from(locations)[0] || null : null;
            return { ...m, location };
        });
        return groupByLocation(withLocation);
    }, [fullyBusy, schedules, overlappingSlots, day]);

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                        <Users className="h-5 w-5 text-cyan-400" /> Who&apos;s Free
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                        Pick a day order and time window to see who&apos;s free, in class, in lab, or online.
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="mb-1 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && runTextSearch()}
                        placeholder='Try "do1 who is free between 1pm and 3pm"'
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    />
                </div>
                <button
                    onClick={runTextSearch}
                    className="shrink-0 rounded-xl bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30 transition hover:bg-cyan-500/25"
                >
                    Search
                </button>
            </div>
            {queryError ? (
                <p className="mb-4 mt-2 text-xs text-red-400">{queryError}</p>
            ) : (
                <p className="mb-4 mt-2 text-xs text-gray-600">Or set the filters directly:</p>
            )}

            <div className="mb-5 grid gap-3 sm:grid-cols-4">
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Day Order</span>
                    <select
                        value={dayIndex}
                        onChange={(e) => setDayIndex(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    >
                        {DAYS.map((d, i) => (
                            <option key={d} value={i} className="bg-gray-900">
                                {d}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">From</span>
                    <select
                        value={startMin}
                        onChange={(e) => setStartMin(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    >
                        {TIME_BOUNDARIES.map((m) => (
                            <option key={m} value={m} className="bg-gray-900">
                                {formatMinutes(m)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">To</span>
                    <select
                        value={endMin}
                        onChange={(e) => setEndMin(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    >
                        {TIME_BOUNDARIES.map((m) => (
                            <option key={m} value={m} className="bg-gray-900">
                                {formatMinutes(m)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Domain</span>
                    <select
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    >
                        {domains.map((d) => (
                            <option key={d} value={d} className="bg-gray-900">
                                {d}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
            ) : endMin <= startMin ? (
                <p className="p-6 text-center text-sm text-gray-500">Pick a &quot;To&quot; time after the &quot;From&quot; time.</p>
            ) : overlappingSlots.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500">No timetable slots fall in that window.</p>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                        <p className="mb-3 text-sm font-bold text-emerald-300">
                            Free the whole time ({day} · {formatMinutes(startMin)}–{formatMinutes(endMin)}) ({fullyFree.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {fullyFree.length === 0 ? (
                                <span className="text-xs text-gray-500">Nobody&apos;s free for the whole window — see the slot-by-slot breakdown below.</span>
                            ) : (
                                fullyFree.map((m) => (
                                    <span
                                        key={m.username}
                                        className="rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
                                    >
                                        {m.name}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="mb-3 text-sm font-bold text-gray-200">
                            In Class/Lab the whole time ({day} · {formatMinutes(startMin)}–{formatMinutes(endMin)}) ({fullyBusy.length})
                        </p>
                        {fullyBusy.length === 0 ? (
                            <span className="text-xs text-gray-500">Nobody&apos;s in Class/Lab for the whole window.</span>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {fullyBusyGroups.map((bucket) => (
                                    <div key={bucket.key}>
                                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            {bucket.label} ({bucket.items.length})
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {bucket.items.map((m) => (
                                                <span
                                                    key={m.username}
                                                    className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-gray-200 ring-1 ring-inset ring-white/20"
                                                >
                                                    {m.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Slot-by-slot breakdown</p>

                    {overlappingSlots.map((slotIndex) => {
                        const groups: Record<string, Array<RosterMember & { location: string | null }>> = {
                            "": [],
                            class: [],
                            lab: [],
                            online: [],
                        };
                        filteredMembers.forEach((member) => {
                            const schedule = schedules[member.username];
                            if (!schedule) return;
                            const cell = schedule[day]?.[slotIndex];
                            const value = cell?.status || "";
                            (groups[value] ||= []).push({ ...member, location: cell?.location ?? null });
                        });

                        return (
                            <div key={slotIndex} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                <p className="mb-3 text-sm font-bold text-white">
                                    {day} · {TIME_SLOTS[slotIndex]}
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {STATUS_KEYS.map((statusKey) => (
                                        <div key={statusKey}>
                                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                {STATUS_LABELS[statusKey]} ({groups[statusKey].length})
                                            </p>
                                            {groups[statusKey].length === 0 ? (
                                                <span className="text-xs text-gray-600">—</span>
                                            ) : isLocatedStatus(statusKey) ? (
                                                <div className="space-y-2">
                                                    {groupByLocation(groups[statusKey]).map((bucket) => (
                                                        <div key={bucket.key}>
                                                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                                                                {bucket.label} ({bucket.items.length})
                                                            </p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {bucket.items.map((m) => (
                                                                    <span
                                                                        key={m.username}
                                                                        className={`rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[statusKey]}`}
                                                                    >
                                                                        {m.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {groups[statusKey].map((m) => (
                                                        <span
                                                            key={m.username}
                                                            className={`rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[statusKey]}`}
                                                        >
                                                            {m.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {noData.length > 0 && (
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                                No timetable saved ({noData.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {noData.map((m) => (
                                    <span
                                        key={m.username}
                                        className="rounded-lg bg-white/5 px-2 py-1 text-xs text-gray-500 ring-1 ring-inset ring-white/10"
                                    >
                                        {m.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
