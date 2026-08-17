"use client";

import { useEffect, useState } from "react";
import {
    CAMPUS_OPTIONS,
    CELL_OPTIONS,
    DAYS,
    DEFAULT_CAMPUS,
    TIME_SLOTS,
    slotsInRange,
    TIME_SLOT_RANGES,
    type TimetableSchedule,
} from "@/lib/timetable";

const CELL_LABELS: Record<string, string> = Object.fromEntries(CELL_OPTIONS.map((o) => [o.value, o.label]));

// Minutes-from-midnight for a slot the leave window fully or partially covers.
function timeToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}

interface LeaveWindow {
    startTime: string | null;
    endTime: string | null;
}

// Which TIME_SLOTS indexes an approved leave for "today" covers — null start/end
// means a full-day leave, so every slot is covered.
function leaveSlotIndexes(leave: LeaveWindow): Set<number> {
    if (!leave.startTime || !leave.endTime) {
        return new Set(TIME_SLOT_RANGES.map((_, i) => i));
    }
    return new Set(slotsInRange(timeToMinutes(leave.startTime), timeToMinutes(leave.endTime)));
}

// Read-only badge styling (soft, tinted).
const BADGE_STYLES: Record<string, string> = {
    "": "bg-white/5 text-gray-500 ring-1 ring-inset ring-white/10",
    class: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
    lab: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
    online: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
};

// Editable, selected-button styling (solid, high-contrast).
const ACTIVE_STYLES: Record<string, string> = {
    "": "bg-white/20 text-white ring-1 ring-inset ring-white/30",
    class: "bg-amber-500 text-black",
    lab: "bg-blue-500 text-white",
    online: "bg-emerald-500 text-black",
};

interface TimetableGridProps {
    schedule: TimetableSchedule;
    campus?: string;
    editable?: boolean;
    onChange?: (day: string, slotIndex: number, value: string) => void;
    onCampusChange?: (campus: string) => void;
    // Today's real Day Order (from /api/dashboard/day-order), if known — used to
    // default the tab selection to "today" instead of always DO1.
    todayDayOrder?: string | null;
    // The viewed member's approved leave covering today, if any — overlaid as an
    // "On Leave" badge on the affected slots, but only while the "today" tab is active
    // (a leave is a real-date fact, not something that applies to every DO-tab).
    leaveToday?: LeaveWindow | null;
}

// Compact view: one day-order visible at a time (tabs) with a dense row-per-slot table,
// instead of rendering all 5 days x 10 slots as ~50 separate cards at once.
export default function TimetableGrid({
    schedule,
    campus = DEFAULT_CAMPUS,
    editable = false,
    onChange,
    onCampusChange,
    todayDayOrder = null,
    leaveToday = null,
}: TimetableGridProps) {
    const [activeDay, setActiveDay] = useState<(typeof DAYS)[number]>(DAYS[0]);

    // One-time sync once the parent's day-order fetch resolves — doesn't fight a
    // manual tab click afterwards since todayDayOrder only transitions null -> value once.
    useEffect(() => {
        if (todayDayOrder && (DAYS as readonly string[]).includes(todayDayOrder)) {
            setActiveDay(todayDayOrder as (typeof DAYS)[number]);
        }
    }, [todayDayOrder]);

    const row = schedule[activeDay] || [];
    const isTodayTab = !editable && todayDayOrder !== null && activeDay === todayDayOrder;
    const onLeaveSlots = isTodayTab && leaveToday ? leaveSlotIndexes(leaveToday) : null;

    return (
        <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                        <button
                            key={day}
                            type="button"
                            onClick={() => setActiveDay(day)}
                            className={`px-4 py-2 text-sm font-bold transition ${
                                activeDay === day
                                    ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                                    : "text-gray-400 hover:bg-white/5"
                            }`}
                        >
                            {day}
                            {!editable && todayDayOrder === day && (
                                <span className="ml-1.5 align-middle text-[10px] font-bold text-cyan-400">TODAY</span>
                            )}
                        </button>
                    ))}
                </div>

                {editable ? (
                    <label className="flex items-center gap-2 sm:shrink-0">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Campus</span>
                        <select
                            value={campus}
                            onChange={(e) => onCampusChange?.(e.target.value)}
                            className="border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white outline-none transition focus:border-cyan-500"
                        >
                            {CAMPUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value} className="bg-gray-900">
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : (
                    <span className="inline-flex w-fit items-center gap-1.5 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10">
                        {CAMPUS_OPTIONS.find((o) => o.value === campus)?.label ?? campus}
                    </span>
                )}
            </div>

            <div className="overflow-hidden border border-white/10">
                {TIME_SLOTS.map((slot, slotIndex) => {
                    const value = row[slotIndex] || "";
                    return (
                        <div
                            key={slot}
                            className="flex flex-col gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
                        >
                            <span className="text-sm font-semibold text-gray-400 sm:pt-1.5">{slot}</span>
                            {editable ? (
                                <div className="grid grid-cols-4 gap-1.5 sm:w-auto sm:min-w-[280px]">
                                    {CELL_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => onChange?.(activeDay, slotIndex, option.value)}
                                            className={`px-2 py-1.5 text-xs font-bold transition ${
                                                value === option.value
                                                    ? ACTIVE_STYLES[option.value]
                                                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                                    <span
                                        className={`inline-flex w-fit items-center px-3 py-1.5 text-sm font-bold sm:w-auto sm:min-w-32 sm:justify-center ${
                                            BADGE_STYLES[value] ?? BADGE_STYLES[""]
                                        }`}
                                    >
                                        {value ? CELL_LABELS[value] ?? value : "Free"}
                                    </span>
                                    {onLeaveSlots?.has(slotIndex) && (
                                        <span className="inline-flex w-fit items-center px-3 py-1.5 text-sm font-bold bg-purple-500/15 text-purple-300 ring-1 ring-inset ring-purple-500/30">
                                            On Leave
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
