"use client";

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

export default function TimetableGrid({ schedule, editable = false, onChange }: TimetableGridProps) {
    return (
        <div className="space-y-10">
            {DAYS.map((day) => {
                const row = schedule[day] || [];
                return (
                    <div key={day}>
                        <h3 className="mb-4 text-xl font-black tracking-tight text-white">{day}</h3>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                            {TIME_SLOTS.map((slot, slotIndex) => {
                                const value = row[slotIndex] || "";
                                return (
                                    <div
                                        key={slot}
                                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                                    >
                                        <p className="mb-3 text-sm font-semibold text-gray-400">{slot}</p>
                                        {editable ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {CELL_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => onChange?.(day, slotIndex, option.value)}
                                                        className={`rounded-xl px-2 py-3 text-sm font-bold transition ${
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
                                                className={`flex w-full items-center justify-center rounded-xl px-3 py-3 text-base font-bold ${
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
            })}
        </div>
    );
}
