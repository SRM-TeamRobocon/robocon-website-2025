export const TIME_SLOTS = [
    "8:00-8:50",
    "8:50-9:40",
    "9:45-10:35",
    "10:40-11:30",
    "11:35-12:25",
    "12:30-1:20",
    "1:25-2:15",
    "2:20-3:10",
    "3:10-4:00",
    "4:00-4:50",
] as const;

// Row labels as used in the source spreadsheet — not day names.
export const DAYS = ["DO1", "DO2", "DO3", "DO4", "DO5"] as const;

export const CELL_OPTIONS = [
    { value: "", label: "Free" },
    { value: "class", label: "Class" },
    { value: "lab", label: "Lab" },
    { value: "online", label: "Online" },
] as const;

const CELL_VALUES = new Set<string>(CELL_OPTIONS.map((o) => o.value));

export type TimetableSchedule = Record<string, string[]>;

export function emptySchedule(): TimetableSchedule {
    const schedule: TimetableSchedule = {};
    for (const day of DAYS) {
        schedule[day] = TIME_SLOTS.map(() => "");
    }
    return schedule;
}

// Drops unknown days/values and pads/truncates rows to TIME_SLOTS.length so bad
// client input can't corrupt the stored grid shape.
export function normalizeSchedule(input: unknown): TimetableSchedule {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const schedule: TimetableSchedule = {};

    for (const day of DAYS) {
        const row = Array.isArray(source[day]) ? (source[day] as unknown[]) : [];
        const cells: string[] = [];
        for (let i = 0; i < TIME_SLOTS.length; i += 1) {
            const raw = row[i];
            const value = typeof raw === "string" && CELL_VALUES.has(raw) ? raw : "";
            cells.push(value);
        }
        schedule[day] = cells;
    }

    return schedule;
}
