/**
 * calendar-storage.ts
 *
 * Data model, localStorage CRUD and recurrence calculation
 * for calendar events and birthdays.
 * Intentionally decoupled from UI so a future Supabase adapter
 * can be dropped in by swapping only this module.
 *
 * Storage keys:
 * - Events:    robocon_calendar_events
 * - Birthdays: robocon_calendar_birthdays
 */

export type EventCategory =
  | "Meeting"
  | "Competition"
  | "Workshop"
  | "Deadline"
  | "Team Activity"
  | "Other";

export const EVENT_CATEGORIES: EventCategory[] = [
  "Meeting",
  "Competition",
  "Workshop",
  "Deadline",
  "Team Activity",
  "Other",
];

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  Meeting: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  Competition: "bg-red/20 text-red border-red/40",
  Workshop: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  Deadline: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  "Team Activity": "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  Other: "bg-gray-500/20 text-gray-300 border-gray-500/40",
};

export const CATEGORY_DOT: Record<EventCategory, string> = {
  Meeting: "bg-blue-400",
  Competition: "bg-red",
  Workshop: "bg-violet-400",
  Deadline: "bg-amber-400",
  "Team Activity": "bg-emerald-400",
  Other: "bg-gray-400",
};

/** Shape mirrors a future Supabase row (snake_case preserved via aliases). */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  /** ISO date string yyyy-mm-dd */
  startDate: string;
  /** HH:mm — 24-hour */
  startTime: string;
  /** ISO date string yyyy-mm-dd */
  endDate: string;
  /** HH:mm — 24-hour */
  endTime: string;
  category: EventCategory;
  location: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
}

export type NewCalendarEvent = Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">;

// ─── Birthday Types ─────────────────────────────────────────────────────────

export interface BirthdayRecord {
  id: string;
  name: string;
  /** Complete ISO date of birth: yyyy-mm-dd */
  dob: string;
  description?: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
}

export type NewBirthdayRecord = Omit<BirthdayRecord, "id" | "createdAt" | "updatedAt">;

export interface BirthdayOccurrence {
  record: BirthdayRecord;
  /** Calculated occurrence date string in target year: yyyy-mm-dd */
  dateStr: string;
  /** Age reached in target year */
  age: number;
  /** Dynamic contextual status text, e.g. "Turns 19 Today!", "Turning 19", "Turned 19" */
  statusText: string;
  /** Whether this birthday is observed on Feb 28 due to leap year shift */
  isLeapAdjusted?: boolean;
}

const EVENTS_STORAGE_KEY = "robocon_calendar_events";
const BIRTHDAYS_STORAGE_KEY = "robocon_calendar_birthdays";

function generateId(prefix = "evt"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Safe LocalStorage Read/Write ──────────────────────────────────────────

function readEvents(): CalendarEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CalendarEvent[];
  } catch {
    return [];
  }
}

function writeEvents(events: CalendarEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Silently ignore quota exceeded
  }
}

function readBirthdays(): BirthdayRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BIRTHDAYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as BirthdayRecord[];
  } catch {
    return [];
  }
}

function writeBirthdays(birthdays: BirthdayRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BIRTHDAYS_STORAGE_KEY, JSON.stringify(birthdays));
  } catch {
    // Silently ignore quota exceeded
  }
}

// ─── Event Storage Operations ──────────────────────────────────────────────

export const calendarStorage = {
  getAll(): CalendarEvent[] {
    return readEvents();
  },

  getByDate(dateStr: string): CalendarEvent[] {
    return readEvents().filter(
      (e) => e.startDate <= dateStr && e.endDate >= dateStr
    );
  },

  add(data: NewCalendarEvent): CalendarEvent {
    const events = readEvents();
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      ...data,
      id: generateId("evt"),
      createdAt: now,
      updatedAt: now,
    };
    events.push(event);
    writeEvents(events);
    return event;
  },

  update(id: string, data: Partial<NewCalendarEvent>): CalendarEvent | null {
    const events = readEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated: CalendarEvent = {
      ...events[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    events[idx] = updated;
    writeEvents(events);
    return updated;
  },

  delete(id: string): boolean {
    const events = readEvents();
    const next = events.filter((e) => e.id !== id);
    if (next.length === events.length) return false;
    writeEvents(next);
    return true;
  },
};

// ─── Birthday Storage Operations ───────────────────────────────────────────

export const birthdayStorage = {
  getAll(): BirthdayRecord[] {
    return readBirthdays();
  },

  getById(id: string): BirthdayRecord | null {
    return readBirthdays().find((b) => b.id === id) ?? null;
  },

  add(data: NewBirthdayRecord): BirthdayRecord {
    const birthdays = readBirthdays();
    const now = new Date().toISOString();
    const bday: BirthdayRecord = {
      ...data,
      id: generateId("bday"),
      createdAt: now,
      updatedAt: now,
    };
    birthdays.push(bday);
    writeBirthdays(birthdays);
    return bday;
  },

  update(id: string, data: Partial<NewBirthdayRecord>): BirthdayRecord | null {
    const birthdays = readBirthdays();
    const idx = birthdays.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    const updated: BirthdayRecord = {
      ...birthdays[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    birthdays[idx] = updated;
    writeBirthdays(birthdays);
    return updated;
  },

  delete(id: string): boolean {
    const birthdays = readBirthdays();
    const next = birthdays.filter((b) => b.id !== id);
    if (next.length === birthdays.length) return false;
    writeBirthdays(next);
    return true;
  },
};

// ─── Leap Year & Date Calculations ──────────────────────────────────────────

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Calculates a recurring birthday occurrence for a specific target year.
 * Handles:
 * - Leap year: February 29 birthdays observed on February 28 in non-leap years.
 * - Dynamic age: (targetYear - birthYear)
 * - Dynamic context status wording:
 *   - Current year:
 *     - Today: "Turns [age] Today!"
 *     - Upcoming: "Turning [age]"
 *     - Passed: "Turned [age]"
 *   - Historical year: "Turned [age]"
 *   - Future year: "Turns [age]"
 */
export function getBirthdayOccurrence(
  record: BirthdayRecord,
  targetYear: number,
  today: Date = new Date()
): BirthdayOccurrence | null {
  if (!record.dob) return null;
  const parts = record.dob.split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return null;
  const [bYear, bMonth, bDay] = parts;

  // If the person was born after the target year, they don't have a birthday in that year
  if (targetYear < bYear) return null;

  let day = bDay;
  let month = bMonth;
  let isLeapAdjusted = false;

  // Leap year Feb 29 handling
  if (month === 2 && day === 29) {
    if (!isLeapYear(targetYear)) {
      day = 28;
      isLeapAdjusted = true;
    }
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const dateStr = `${targetYear}-${mm}-${dd}`;
  const age = targetYear - bYear;

  const currentYear = today.getFullYear();
  const todayStr = toDateStr(today);

  let statusText = "";
  if (targetYear === currentYear) {
    if (todayStr === dateStr) {
      statusText = age === 0 ? "Born Today!" : `Turns ${age} Today!`;
    } else if (todayStr < dateStr) {
      statusText = age === 0 ? "Born this year" : `Turning ${age}`;
    } else {
      statusText = age === 0 ? "Born this year" : `Turned ${age}`;
    }
  } else if (targetYear < currentYear) {
    statusText = age === 0 ? "Born" : `Turned ${age}`;
  } else {
    statusText = `Turns ${age}`;
  }

  return {
    record,
    dateStr,
    age,
    statusText,
    isLeapAdjusted,
  };
}

export function getBirthdaysForYear(
  birthdays: BirthdayRecord[],
  targetYear: number,
  today: Date = new Date()
): BirthdayOccurrence[] {
  const result: BirthdayOccurrence[] = [];
  for (const b of birthdays) {
    const occ = getBirthdayOccurrence(b, targetYear, today);
    if (occ) result.push(occ);
  }
  return result;
}

export function getBirthdaysForDate(
  birthdays: BirthdayRecord[],
  dateStr: string,
  today: Date = new Date()
): BirthdayOccurrence[] {
  const year = parseInt(dateStr.slice(0, 4), 10);
  if (isNaN(year)) return [];
  const yearBirthdays = getBirthdaysForYear(birthdays, year, today);
  return yearBirthdays.filter((b) => b.dateStr === dateStr);
}

// ─── Standard Date helpers ──────────────────────────────────────────────────

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateStr(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(str: string): string {
  if (!str) return "";
  const [y, m, d] = str.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDisplayDateLong(str: string): string {
  if (!str) return "";
  const [y, m, d] = str.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function getWeekDays(anchor: Date): Date[] {
  const start = new Date(anchor);
  const day = start.getDay(); // 0=Sun
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function HOURS(): string[] {
  return Array.from({ length: 24 }, (_, i) => {
    const h = i % 12 === 0 ? 12 : i % 12;
    const ampm = i < 12 ? "AM" : "PM";
    return `${String(h).padStart(2, "0")}:00 ${ampm}`;
  });
}
