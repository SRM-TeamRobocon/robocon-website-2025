/**
 * calendar-storage.ts
 *
 * Data model and localStorage CRUD for calendar events.
 * Intentionally decoupled from UI so a future Supabase adapter
 * can be dropped in by swapping only this module.
 *
 * Storage key: robocon_calendar_events
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

const STORAGE_KEY = "robocon_calendar_events";

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readAll(): CalendarEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CalendarEvent[];
  } catch {
    return [];
  }
}

function writeAll(events: CalendarEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Storage quota exceeded — silently ignore.
  }
}

export const calendarStorage = {
  getAll(): CalendarEvent[] {
    return readAll();
  },

  getByDate(dateStr: string): CalendarEvent[] {
    return readAll().filter(
      (e) => e.startDate <= dateStr && e.endDate >= dateStr
    );
  },

  add(data: NewCalendarEvent): CalendarEvent {
    const events = readAll();
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    events.push(event);
    writeAll(events);
    return event;
  },

  update(id: string, data: Partial<NewCalendarEvent>): CalendarEvent | null {
    const events = readAll();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated: CalendarEvent = {
      ...events[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    events[idx] = updated;
    writeAll(events);
    return updated;
  },

  delete(id: string): boolean {
    const events = readAll();
    const next = events.filter((e) => e.id !== id);
    if (next.length === events.length) return false;
    writeAll(next);
    return true;
  },
};

// ─── Date helpers ────────────────────────────────────────────────────────────

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
  const d = parseDateStr(str);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
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
