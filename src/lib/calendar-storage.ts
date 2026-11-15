/**
 * calendar-storage.ts
 *
 * Data model, client-side Supabase API integration, recurrence calculations,
 * and seamless LocalStorage migration fallback.
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

/** Shape mirrors Supabase calendar_events row */
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
  createdBy?: string | null;
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
  createdBy?: string | null;
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
const MIGRATION_FLAG_KEY = "robocon_calendar_migrated_v1";

function generateId(prefix = "evt"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── LocalStorage Helpers ──────────────────────────────────────────────────

export function readLocalEvents(): CalendarEvent[] {
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

export function writeLocalEvents(events: CalendarEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch {}
}

export function readLocalBirthdays(): BirthdayRecord[] {
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

export function writeLocalBirthdays(birthdays: BirthdayRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BIRTHDAYS_STORAGE_KEY, JSON.stringify(birthdays));
  } catch {}
}

// ─── Data Mappers: Supabase <-> Frontend ───────────────────────────────────

export function mapSupabaseEventToFrontend(row: any): CalendarEvent {
  const start = new Date(row.start_at);
  const end = new Date(row.end_at);

  const startDate = toDateStr(start);
  const startTime =
    row.start_at.includes("T") && !row.start_at.endsWith("T00:00:00.000Z") && !row.start_at.endsWith("T00:00:00Z")
      ? `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`
      : "";

  const endDate = toDateStr(end);
  const endTime =
    row.end_at.includes("T") && !row.end_at.endsWith("T00:00:00.000Z") && !row.end_at.endsWith("T23:59:59.000Z")
      ? `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`
      : "";

  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    startDate,
    startTime,
    endDate,
    endTime,
    category: row.category,
    location: row.location || "",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFrontendEventToSupabase(event: NewCalendarEvent) {
  const startAt = event.startTime
    ? new Date(`${event.startDate}T${event.startTime}:00`).toISOString()
    : new Date(`${event.startDate}T00:00:00`).toISOString();

  const endAt = event.endTime
    ? new Date(`${event.endDate}T${event.endTime}:00`).toISOString()
    : new Date(`${event.endDate}T23:59:59`).toISOString();

  return {
    title: event.title,
    description: event.description || null,
    start_at: startAt,
    end_at: endAt,
    category: event.category,
    location: event.location || null,
  };
}

export function mapSupabaseBirthdayToFrontend(row: any): BirthdayRecord {
  return {
    id: row.id,
    name: row.name,
    dob: typeof row.date_of_birth === "string" ? row.date_of_birth.slice(0, 10) : toDateStr(new Date(row.date_of_birth)),
    description: row.description || "",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFrontendBirthdayToSupabase(bday: NewBirthdayRecord) {
  return {
    name: bday.name,
    date_of_birth: bday.dob,
    description: bday.description || null,
  };
}

// ─── Unified Client API with Supabase & Offline Migration ──────────────────

export const calendarApi = {
  // --- Events ---
  async fetchEvents(): Promise<{ events: CalendarEvent[]; source: "supabase" | "local"; error?: string }> {
    try {
      const res = await fetch("/api/calendar/events", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        const events = json.data.map(mapSupabaseEventToFrontend);
        writeLocalEvents(events); // update local mirror
        return { events, source: "supabase" };
      }
      // If server returned table-not-ready or unauthorized, fallback to local
      const local = readLocalEvents();
      return { events: local, source: "local", error: json.error };
    } catch {
      const local = readLocalEvents();
      return { events: local, source: "local" };
    }
  },

  async addEvent(data: NewCalendarEvent): Promise<{ event: CalendarEvent; source: "supabase" | "local" }> {
    try {
      const payload = mapFrontendEventToSupabase(data);
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const event = mapSupabaseEventToFrontend(json.data);
        const current = readLocalEvents();
        writeLocalEvents([...current, event]);
        return { event, source: "supabase" };
      }
    } catch {}

    // Fallback: save locally
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      ...data,
      id: generateId("evt"),
      createdAt: now,
      updatedAt: now,
    };
    const current = readLocalEvents();
    writeLocalEvents([...current, event]);
    return { event, source: "local" };
  },

  async updateEvent(id: string, data: Partial<NewCalendarEvent>, existing: CalendarEvent): Promise<{ event: CalendarEvent; source: "supabase" | "local" }> {
    const merged: NewCalendarEvent = {
      title: data.title ?? existing.title,
      description: data.description ?? existing.description,
      startDate: data.startDate ?? existing.startDate,
      startTime: data.startTime ?? existing.startTime,
      endDate: data.endDate ?? existing.endDate,
      endTime: data.endTime ?? existing.endTime,
      category: data.category ?? existing.category,
      location: data.location ?? existing.location,
    };

    try {
      const payload = { id, ...mapFrontendEventToSupabase(merged) };
      const res = await fetch("/api/calendar/events", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const updated = mapSupabaseEventToFrontend(json.data);
        const current = readLocalEvents().map((e) => (e.id === id ? updated : e));
        writeLocalEvents(current);
        return { event: updated, source: "supabase" };
      }
    } catch {}

    // Fallback
    const updated: CalendarEvent = {
      ...existing,
      ...merged,
      updatedAt: new Date().toISOString(),
    };
    const current = readLocalEvents().map((e) => (e.id === id ? updated : e));
    writeLocalEvents(current);
    return { event: updated, source: "local" };
  },

  async deleteEvent(id: string): Promise<boolean> {
    try {
      await fetch(`/api/calendar/events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {}
    const next = readLocalEvents().filter((e) => e.id !== id);
    writeLocalEvents(next);
    return true;
  },

  // --- Birthdays ---
  async fetchBirthdays(): Promise<{ birthdays: BirthdayRecord[]; source: "supabase" | "local"; error?: string }> {
    try {
      const res = await fetch("/api/calendar/birthdays", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        const birthdays = json.data.map(mapSupabaseBirthdayToFrontend);
        writeLocalBirthdays(birthdays);
        return { birthdays, source: "supabase" };
      }
      const local = readLocalBirthdays();
      return { birthdays: local, source: "local", error: json.error };
    } catch {
      const local = readLocalBirthdays();
      return { birthdays: local, source: "local" };
    }
  },

  async addBirthday(data: NewBirthdayRecord): Promise<{ birthday: BirthdayRecord; source: "supabase" | "local" }> {
    try {
      const payload = mapFrontendBirthdayToSupabase(data);
      const res = await fetch("/api/calendar/birthdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const birthday = mapSupabaseBirthdayToFrontend(json.data);
        const current = readLocalBirthdays();
        writeLocalBirthdays([...current, birthday]);
        return { birthday, source: "supabase" };
      }
    } catch {}

    // Fallback
    const now = new Date().toISOString();
    const birthday: BirthdayRecord = {
      ...data,
      id: generateId("bday"),
      createdAt: now,
      updatedAt: now,
    };
    const current = readLocalBirthdays();
    writeLocalBirthdays([...current, birthday]);
    return { birthday, source: "local" };
  },

  async updateBirthday(id: string, data: Partial<NewBirthdayRecord>, existing: BirthdayRecord): Promise<{ birthday: BirthdayRecord; source: "supabase" | "local" }> {
    const merged: NewBirthdayRecord = {
      name: data.name ?? existing.name,
      dob: data.dob ?? existing.dob,
      description: data.description ?? existing.description,
    };

    try {
      const payload = { id, ...mapFrontendBirthdayToSupabase(merged) };
      const res = await fetch("/api/calendar/birthdays", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const updated = mapSupabaseBirthdayToFrontend(json.data);
        const current = readLocalBirthdays().map((b) => (b.id === id ? updated : b));
        writeLocalBirthdays(current);
        return { birthday: updated, source: "supabase" };
      }
    } catch {}

    const updated: BirthdayRecord = {
      ...existing,
      ...merged,
      updatedAt: new Date().toISOString(),
    };
    const current = readLocalBirthdays().map((b) => (b.id === id ? updated : b));
    writeLocalBirthdays(current);
    return { birthday: updated, source: "local" };
  },

  async deleteBirthday(id: string): Promise<boolean> {
    try {
      await fetch(`/api/calendar/birthdays?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {}
    const next = readLocalBirthdays().filter((b) => b.id !== id);
    writeLocalBirthdays(next);
    return true;
  },

  // --- LocalStorage Migration Handler ---
  async syncLocalStorageToSupabase(): Promise<{ migratedEvents: number; migratedBirthdays: number }> {
    if (typeof window === "undefined") return { migratedEvents: 0, migratedBirthdays: 0 };
    if (window.localStorage.getItem(MIGRATION_FLAG_KEY) === "1") {
      return { migratedEvents: 0, migratedBirthdays: 0 };
    }

    const localEvents = readLocalEvents();
    const localBirthdays = readLocalBirthdays();
    let migratedEvents = 0;
    let migratedBirthdays = 0;

    // Check if Supabase is reachable and tables exist
    try {
      const test = await fetch("/api/calendar/events", { cache: "no-store" });
      const testJson = await test.json();
      if (!test.ok || !testJson.success) {
        // Database tables not ready; keep local data intact and retry later
        return { migratedEvents: 0, migratedBirthdays: 0 };
      }

      const existingSupabaseEvents = (testJson.data || []).map(mapSupabaseEventToFrontend);
      for (const ev of localEvents) {
        // Prevent duplicate by matching title, startDate, endDate
        const exists = existingSupabaseEvents.some(
          (se: CalendarEvent) => se.title === ev.title && se.startDate === ev.startDate && se.endDate === ev.endDate
        );
        if (!exists) {
          const payload = mapFrontendEventToSupabase(ev);
          await fetch("/api/calendar/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          migratedEvents++;
        }
      }

      const testBdays = await fetch("/api/calendar/birthdays", { cache: "no-store" });
      const testBdaysJson = await testBdays.json();
      if (testBdays.ok && testBdaysJson.success) {
        const existingSupabaseBdays = (testBdaysJson.data || []).map(mapSupabaseBirthdayToFrontend);
        for (const bd of localBirthdays) {
          const exists = existingSupabaseBdays.some(
            (sb: BirthdayRecord) => sb.name === bd.name && sb.dob === bd.dob
          );
          if (!exists) {
            const payload = mapFrontendBirthdayToSupabase(bd);
            await fetch("/api/calendar/birthdays", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            migratedBirthdays++;
          }
        }
      }

      window.localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    } catch {}

    return { migratedEvents, migratedBirthdays };
  },
};

// ─── Synchronous storage helpers (backwards compatibility for components) ───

export const calendarStorage = {
  getAll(): CalendarEvent[] {
    return readLocalEvents();
  },
  getByDate(dateStr: string): CalendarEvent[] {
    return readLocalEvents().filter((e) => e.startDate <= dateStr && e.endDate >= dateStr);
  },
  add(data: NewCalendarEvent): CalendarEvent {
    const events = readLocalEvents();
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      ...data,
      id: generateId("evt"),
      createdAt: now,
      updatedAt: now,
    };
    events.push(event);
    writeLocalEvents(events);
    return event;
  },
  update(id: string, data: Partial<NewCalendarEvent>): CalendarEvent | null {
    const events = readLocalEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated: CalendarEvent = {
      ...events[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    events[idx] = updated;
    writeLocalEvents(events);
    return updated;
  },
  delete(id: string): boolean {
    const events = readLocalEvents();
    const next = events.filter((e) => e.id !== id);
    if (next.length === events.length) return false;
    writeLocalEvents(next);
    return true;
  },
};

export const birthdayStorage = {
  getAll(): BirthdayRecord[] {
    return readLocalBirthdays();
  },
  getById(id: string): BirthdayRecord | null {
    return readLocalBirthdays().find((b) => b.id === id) ?? null;
  },
  add(data: NewBirthdayRecord): BirthdayRecord {
    const birthdays = readLocalBirthdays();
    const now = new Date().toISOString();
    const bday: BirthdayRecord = {
      ...data,
      id: generateId("bday"),
      createdAt: now,
      updatedAt: now,
    };
    birthdays.push(bday);
    writeLocalBirthdays(birthdays);
    return bday;
  },
  update(id: string, data: Partial<NewBirthdayRecord>): BirthdayRecord | null {
    const birthdays = readLocalBirthdays();
    const idx = birthdays.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    const updated: BirthdayRecord = {
      ...birthdays[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    birthdays[idx] = updated;
    writeLocalBirthdays(birthdays);
    return updated;
  },
  delete(id: string): boolean {
    const birthdays = readLocalBirthdays();
    const next = birthdays.filter((b) => b.id !== id);
    if (next.length === birthdays.length) return false;
    writeLocalBirthdays(next);
    return true;
  },
};

// ─── Leap Year & Date Calculations ──────────────────────────────────────────

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function getBirthdayOccurrence(
  record: BirthdayRecord,
  targetYear: number,
  today: Date = new Date()
): BirthdayOccurrence | null {
  if (!record.dob) return null;
  const parts = record.dob.split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return null;
  const [bYear, bMonth, bDay] = parts;

  if (targetYear < bYear) return null;

  let day = bDay;
  let month = bMonth;
  let isLeapAdjusted = false;

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
