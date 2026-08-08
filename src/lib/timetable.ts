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

// Only these statuses carry a physical location.
const LOCATED_STATUSES = new Set<string>(["class", "lab"]);

export function isLocatedStatus(status: string): boolean {
    return LOCATED_STATUSES.has(status);
}

export const LOCATION_OPTIONS = [
    { value: "tp1", label: "TP1" },
    { value: "tp2", label: "TP2" },
    { value: "ub", label: "UB" },
    { value: "hitech", label: "Hi-Tech" },
    { value: "biotech", label: "Biotech" },
    { value: "bel", label: "BEL" },
    { value: "fsh", label: "FSH" },
    { value: "crc", label: "CRC" },
] as const;

const LOCATION_VALUES = new Set<string>(LOCATION_OPTIONS.map((o) => o.value));

export interface TimetableCell {
    status: string;
    location: string | null;
}

export type TimetableSchedule = Record<string, TimetableCell[]>;

function emptyCell(): TimetableCell {
    return { status: "", location: null };
}

export function emptySchedule(): TimetableSchedule {
    const schedule: TimetableSchedule = {};
    for (const day of DAYS) {
        schedule[day] = TIME_SLOTS.map(() => emptyCell());
    }
    return schedule;
}

// Accepts the current { status, location } cell shape as well as the legacy plain-string
// cell shape saved before location tracking existed — old rows load with location: null
// instead of erroring, and the member can fill it in later.
function normalizeCell(raw: unknown): TimetableCell {
    if (typeof raw === "string") {
        return { status: CELL_VALUES.has(raw) ? raw : "", location: null };
    }
    if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        const status = typeof obj.status === "string" && CELL_VALUES.has(obj.status) ? obj.status : "";
        const location =
            LOCATED_STATUSES.has(status) && typeof obj.location === "string" && LOCATION_VALUES.has(obj.location)
                ? obj.location
                : null;
        return { status, location };
    }
    return emptyCell();
}

// Drops unknown days/values and pads/truncates rows to TIME_SLOTS.length so bad
// client input can't corrupt the stored grid shape.
export function normalizeSchedule(input: unknown): TimetableSchedule {
    const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const schedule: TimetableSchedule = {};

    for (const day of DAYS) {
        const row = Array.isArray(source[day]) ? (source[day] as unknown[]) : [];
        const cells: TimetableCell[] = [];
        for (let i = 0; i < TIME_SLOTS.length; i += 1) {
            cells.push(normalizeCell(row[i]));
        }
        schedule[day] = cells;
    }

    return schedule;
}

// Slot boundaries in minutes-from-midnight, index-aligned with TIME_SLOTS. Hand-computed
// from the same strings so "who's free between X and Y" can be answered by comparing
// numbers instead of re-parsing "8:00-8:50" style labels everywhere.
export const TIME_SLOT_RANGES: { start: number; end: number }[] = [
    { start: 480, end: 530 }, // 8:00-8:50
    { start: 530, end: 580 }, // 8:50-9:40
    { start: 585, end: 635 }, // 9:45-10:35
    { start: 640, end: 690 }, // 10:40-11:30
    { start: 695, end: 745 }, // 11:35-12:25
    { start: 750, end: 800 }, // 12:30-1:20
    { start: 805, end: 855 }, // 1:25-2:15
    { start: 860, end: 910 }, // 2:20-3:10
    { start: 910, end: 960 }, // 3:10-4:00
    { start: 960, end: 1010 }, // 4:00-4:50
];

// Every distinct slot boundary, for populating "from"/"to" dropdowns — there's no point
// offering times that don't line up with an actual slot edge.
export const TIME_BOUNDARIES: number[] = Array.from(
    new Set(TIME_SLOT_RANGES.flatMap((r) => [r.start, r.end]))
).sort((a, b) => a - b);

export function formatMinutes(totalMinutes: number): string {
    const h24 = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const meridiem = h24 < 12 ? "AM" : "PM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${meridiem}`;
}

// Snaps an arbitrary minute value to the nearest slot boundary — "down" for a range
// start, "up" for a range end — so free-text times like "1pm" (not itself a boundary)
// still land on a value the From/To dropdowns can actually display.
export function snapToBoundary(min: number, direction: "down" | "up"): number {
    if (direction === "down") {
        let snapped = TIME_BOUNDARIES[0];
        for (const b of TIME_BOUNDARIES) {
            if (b > min) break;
            snapped = b;
        }
        return snapped;
    }
    let snapped = TIME_BOUNDARIES[TIME_BOUNDARIES.length - 1];
    for (let i = TIME_BOUNDARIES.length - 1; i >= 0; i -= 1) {
        if (TIME_BOUNDARIES[i] < min) break;
        snapped = TIME_BOUNDARIES[i];
    }
    return snapped;
}

// Indexes of TIME_SLOTS whose [start, end) overlaps the given [startMin, endMin) window.
export function slotsInRange(startMin: number, endMin: number): number[] {
    return TIME_SLOT_RANGES.reduce<number[]>((acc, range, i) => {
        if (range.start < endMin && range.end > startMin) acc.push(i);
        return acc;
    }, []);
}

export interface ParsedFreeQuery {
    dayIndex: number | null;
    startMin: number | null;
    endMin: number | null;
}

function parseTimeToken(token: string): { hour: number; minute: number; meridiem: "am" | "pm" | null } | null {
    const match = token.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;
    const hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    if (hour > 23 || minute > 59) return null;
    return { hour, minute, meridiem: match[3] ? (match[3].toLowerCase() as "am" | "pm") : null };
}

// The timetable only spans 8:00-4:50, so an hour of 1-4 with no am/pm suffix is
// unambiguously PM in this context (and 8-11 unambiguously AM, 12 unambiguously PM).
function resolveMinutes(token: { hour: number; minute: number; meridiem: "am" | "pm" | null }): number {
    let hour = token.hour;
    const meridiem = token.meridiem ?? (hour === 12 || hour <= 4 ? "pm" : "am");
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return hour * 60 + token.minute;
}

// Best-effort parse of free-text queries like "on do1 who is free btw 1pm and 3pm".
// Returns whatever it can find; callers fall back to the structured filters for the rest.
export function parseFreeTextQuery(query: string): ParsedFreeQuery {
    const lower = query.toLowerCase();

    const dayMatch = lower.match(/\bdo\s*-?\s*([1-5])\b/);
    const dayIndex = dayMatch ? parseInt(dayMatch[1], 10) - 1 : null;

    const rangeMatch = lower.match(
        /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|and|btw|between|through|till|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/
    );

    let startMin: number | null = null;
    let endMin: number | null = null;
    if (rangeMatch) {
        const startToken = parseTimeToken(rangeMatch[1]);
        const endToken = parseTimeToken(rangeMatch[2]);
        if (startToken && endToken) {
            startMin = resolveMinutes(startToken);
            endMin = resolveMinutes(endToken);
        }
    }

    return { dayIndex, startMin, endMin };
}
