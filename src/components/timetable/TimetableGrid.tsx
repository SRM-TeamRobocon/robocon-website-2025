"use client";

import { useState } from "react";
import { CAMPUS_OPTIONS, CELL_OPTIONS, DAYS, DEFAULT_CAMPUS, TIME_SLOTS, type TimetableSchedule } from "@/lib/timetable";

const CELL_LABELS: Record<string, string> = Object.fromEntries(CELL_OPTIONS.map((o) => [o.value, o.label]));

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
}

// Compact view: one day-order visible at a time (tabs) with a dense row-per-slot table,
// instead of rendering all 5 days x 10 slots as ~50 separate cards at once.
export default function TimetableGrid({
    schedule,
    campus = DEFAULT_CAMPUS,
    editable = false,
    onChange,
    onCampusChange,
}: TimetableGridProps) {
    const [activeDay, setActiveDay] = useState<(typeof DAYS)[number]>(DAYS[0]);
    const row = schedule[activeDay] || [];

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
                                <span
                                    className={`inline-flex w-fit items-center px-3 py-1.5 text-sm font-bold sm:w-auto sm:min-w-32 sm:justify-center ${
                                        BADGE_STYLES[value] ?? BADGE_STYLES[""]
                                    }`}
                                >
                                    {value ? CELL_LABELS[value] ?? value : "Free"}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
