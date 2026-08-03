"use client";

import { useState } from "react";
import { CELL_OPTIONS, DAYS, TIME_SLOTS, type TimetableSchedule } from "@/lib/timetable";

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
    editable?: boolean;
    onChange?: (day: string, slotIndex: number, value: string) => void;
}

// Compact view: one day-order visible at a time (tabs) with a dense row-per-slot table,
// instead of rendering all 5 days x 10 slots as ~50 separate cards at once.
export default function TimetableGrid({ schedule, editable = false, onChange }: TimetableGridProps) {
    const [activeDay, setActiveDay] = useState<(typeof DAYS)[number]>(DAYS[0]);
    const row = schedule[activeDay] || [];

    return (
        <div>
            <div className="mb-4 flex flex-wrap gap-2">
                {DAYS.map((day) => (
                    <button
                        key={day}
                        type="button"
                        onClick={() => setActiveDay(day)}
                        className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                            activeDay === day
                                ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                                : "text-gray-400 hover:bg-white/5"
                        }`}
                    >
                        {day}
                    </button>
                ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
                {TIME_SLOTS.map((slot, slotIndex) => {
                    const value = row[slotIndex] || "";
                    return (
                        <div
                            key={slot}
                            className="flex flex-col gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <span className="text-sm font-semibold text-gray-400">{slot}</span>
                            {editable ? (
                                <div className="grid grid-cols-4 gap-1.5 sm:w-auto sm:min-w-[280px]">
                                    {CELL_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => onChange?.(activeDay, slotIndex, option.value)}
                                            className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${
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
                                    className={`inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-sm font-bold sm:w-32 sm:justify-center ${
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
