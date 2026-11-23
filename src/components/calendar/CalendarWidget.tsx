"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, Database, RefreshCw, AlertCircle, Check } from "lucide-react";

import {
  CalendarEvent,
  EventCategory,
  NewCalendarEvent,
  BirthdayRecord,
  NewBirthdayRecord,
  BirthdayOccurrence,
  calendarApi,
  getBirthdaysForYear,
  getWeekDays,
  toDateStr,
} from "@/lib/calendar-storage";

import CalendarToolbar, { CalendarView, FilterType } from "./CalendarToolbar";
import MiniCalendar from "./MiniCalendar";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import EventModal from "./EventModal";
import EventFormModal from "./EventFormModal";
import BirthdayModal from "./BirthdayModal";
import BirthdayFormModal from "./BirthdayFormModal";

function getRelativeDayString(target: Date, base: Date): string {
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  const diffDays = Math.round((t - b) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1) return `${diffDays} days from today`;
  return `${Math.abs(diffDays)} days ago`;
}

function formatTime12(timeStr?: string): string {
  if (!timeStr) return "ALL DAY";
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return "ALL DAY";
  const m = mStr ? mStr.padStart(2, "0") : "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

function getTypeColorHex(cat: string): string {
  switch (cat) {
    case "Birthdays":
      return "#f5b301";
    case "Meeting":
      return "#5b9cf5";
    case "Competition":
      return "#cc0000";
    case "Workshop":
      return "#a78bfa";
    case "Deadline":
      return "#fb923c";
    case "Team Activity":
      return "#34d399";
    case "Other":
    default:
      return "#9ca3af";
  }
}

export default function CalendarWidget() {
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<CalendarView>("month");
  const [viewDate, setViewDate] = useState<Date>(new Date(today));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(today));

  // Data states
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncSource, setSyncSource] = useState<"supabase" | "local">("local");
  const [dbNotice, setDbNotice] = useState<string | null>(null);

  // Modals for Events
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);

  // Modals for Birthdays
  const [viewingBirthday, setViewingBirthday] = useState<BirthdayOccurrence | null>(null);
  const [editingBirthday, setEditingBirthday] = useState<BirthdayRecord | null>(null);
  const [addBirthdayOpen, setAddBirthdayOpen] = useState(false);

  // Filtering
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterType>("");

  // ─── Initial Load & LocalStorage Migration ─────────────────────────────────
  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, birthdaysRes] = await Promise.all([
        calendarApi.fetchEvents(),
        calendarApi.fetchBirthdays(),
      ]);

      setEvents(eventsRes.events);
      setBirthdays(birthdaysRes.birthdays);

      if (eventsRes.source === "supabase" || birthdaysRes.source === "supabase") {
        setSyncSource("supabase");
        setDbNotice(null);
      } else {
        setSyncSource("local");
        if (eventsRes.error?.includes("PGRST205") || eventsRes.error?.includes("supabase/calendar-schema.sql")) {
          setDbNotice("Database migration pending: run supabase/calendar-schema.sql in Supabase SQL Editor. Using local mirror.");
        }
      }

      calendarApi.syncLocalStorageToSupabase().then((res) => {
        if (res.migratedEvents > 0 || res.migratedBirthdays > 0) {
          toast.success(
            `Migrated ${res.migratedEvents} event(s) & ${res.migratedBirthdays} birthday(s) to Supabase!`
          );
          calendarApi.fetchEvents().then((r) => setEvents(r.events));
          calendarApi.fetchBirthdays().then((r) => setBirthdays(r.birthdays));
        }
      });
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Dynamic Birthday Occurrences: generate for prev/current/next year so month-grid
  // boundary cells (e.g. Jan view showing Dec days) always have correct birthday dots.
  const yearlyBirthdays = useMemo(() => {
    const y = viewDate.getFullYear();
    const prev = getBirthdaysForYear(birthdays, y - 1, today);
    const curr = getBirthdaysForYear(birthdays, y, today);
    const next = getBirthdaysForYear(birthdays, y + 1, today);
    return [...prev, ...curr, ...next];
  }, [birthdays, viewDate, today]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (categoryFilter === "Birthdays") return false;
      if (categoryFilter && ev.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchDesc = ev.description?.toLowerCase().includes(q);
        const matchLoc = ev.location?.toLowerCase().includes(q);
        const matchCat = ev.category.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchLoc && !matchCat) return false;
      }
      return true;
    });
  }, [events, categoryFilter, search]);

  // Filtered Birthdays
  const filteredBirthdays = useMemo(() => {
    if (categoryFilter && categoryFilter !== "Birthdays") return [];
    return yearlyBirthdays.filter((b) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = b.record.name.toLowerCase().includes(q);
        const matchDesc = b.record.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [yearlyBirthdays, categoryFilter, search]);

  // Live Counts for Filter Chips
  const typeCounts = useMemo(() => {
    return {
      Birthdays: yearlyBirthdays.length,
      Meeting: events.filter((e) => e.category === "Meeting").length,
      Competition: events.filter((e) => e.category === "Competition").length,
      Workshop: events.filter((e) => e.category === "Workshop").length,
      Deadline: events.filter((e) => e.category === "Deadline").length,
      "Team Activity": events.filter((e) => e.category === "Team Activity").length,
      Other: events.filter((e) => e.category === "Other").length,
    };
  }, [yearlyBirthdays, events]);

  const totalItemCount = filteredEvents.length + filteredBirthdays.length;

  // Selected Day Items
  const selectedDateStr = useMemo(() => toDateStr(selectedDate), [selectedDate]);

  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter(
      (e) => e.startDate <= selectedDateStr && e.endDate >= selectedDateStr
    );
  }, [filteredEvents, selectedDateStr]);

  const selectedDayBirthdays = useMemo(() => {
    return filteredBirthdays.filter((b) => b.dateStr === selectedDateStr);
  }, [filteredBirthdays, selectedDateStr]);

  const selectedDayItems = useMemo(() => {
    return [
      ...selectedDayBirthdays.map((b) => ({ type: "birthday" as const, data: b })),
      ...selectedDayEvents.map((e) => ({ type: "event" as const, data: e })),
    ];
  }, [selectedDayBirthdays, selectedDayEvents]);

  // Navigation handlers
  function navigate(delta: number) {
    setViewDate((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + delta);
      else if (view === "week") d.setDate(d.getDate() + delta * 7);
      else if (view === "day") d.setDate(d.getDate() + delta);
      return d;
    });
  }

  function goToday() {
    const now = new Date();
    setViewDate(new Date(now));
    setSelectedDate(new Date(now));
  }

  function handleMonthChange(month: number) {
    setViewDate((prev) => {
      const d = new Date(prev);
      d.setMonth(month);
      return d;
    });
  }

  function handleYearChange(year: number) {
    setViewDate((prev) => {
      const d = new Date(prev);
      d.setFullYear(year);
      return d;
    });
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setViewDate(new Date(date));
  }

  // ─── Event CRUD Handlers ───────────────────────────────────────────────────
  const handleAddEvent = useCallback(async (data: NewCalendarEvent) => {
    const res = await calendarApi.addEvent(data);
    setEvents((prev) => [...prev, res.event]);
    setAddEventOpen(false);
    setEditingEvent(null);
    setPrefillDate(undefined);
    toast.success(`Event "${res.event.title}" saved.`);
  }, []);

  const handleUpdateEvent = useCallback(async (data: NewCalendarEvent) => {
    if (!editingEvent) return;
    const res = await calendarApi.updateEvent(editingEvent.id, data, editingEvent);
    setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? res.event : e)));
    setEditingEvent(null);
    setViewingEvent(null);
    toast.success("Event updated successfully.");
  }, [editingEvent]);

  const handleDeleteEvent = useCallback(async (id: string) => {
    const ev = events.find((e) => e.id === id);
    await calendarApi.deleteEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setViewingEvent(null);
    toast.success(`Event "${ev?.title ?? "Event"}" deleted.`);
  }, [events]);

  function openAddEventBlank() {
    setEditingEvent(null);
    setPrefillDate(undefined);
    setAddEventOpen(true);
  }

  function openAddEventOnDate(date: Date) {
    setEditingEvent(null);
    setPrefillDate(toDateStr(date));
    setAddEventOpen(true);
  }

  function openEditEvent(ev: CalendarEvent) {
    setEditingEvent(ev);
    setViewingEvent(null);
  }

  // ─── Birthday CRUD Handlers ────────────────────────────────────────────────
  const handleAddBirthday = useCallback(async (data: NewBirthdayRecord) => {
    const res = await calendarApi.addBirthday(data);
    setBirthdays((prev) => [...prev, res.birthday]);
    setAddBirthdayOpen(false);
    setEditingBirthday(null);
    toast.success(`Birthday for ${res.birthday.name} added!`, {
      icon: "🎂",
      style: {
        background: "#1f2937",
        color: "#fcd34d",
        border: "1px solid #d97706",
      },
    });
  }, []);

  const handleUpdateBirthday = useCallback(async (data: NewBirthdayRecord) => {
    if (!editingBirthday) return;
    const res = await calendarApi.updateBirthday(editingBirthday.id, data, editingBirthday);
    setBirthdays((prev) => prev.map((b) => (b.id === editingBirthday.id ? res.birthday : b)));
    setEditingBirthday(null);
    setViewingBirthday(null);
    toast.success("Birthday updated.", {
      icon: "🎂",
      style: {
        background: "#1f2937",
        color: "#fcd34d",
        border: "1px solid #d97706",
      },
    });
  }, [editingBirthday]);

  const handleDeleteBirthday = useCallback(async (id: string) => {
    const bday = birthdays.find((b) => b.id === id);
    await calendarApi.deleteBirthday(id);
    setBirthdays((prev) => prev.filter((b) => b.id !== id));
    setViewingBirthday(null);
    toast.success(`Birthday for ${bday?.name ?? "Member"} deleted.`);
  }, [birthdays]);

  function openEditBirthday(occ: BirthdayOccurrence) {
    setEditingBirthday(occ.record);
    setViewingBirthday(null);
  }

  // ─── Mini-calendar navigation (for week/day views) ─────────────────────────
  const [miniDate, setMiniDate] = useState<Date>(new Date(today));
  function miniPrev() {
    setMiniDate((d) => {
      const n = new Date(d);
      n.setMonth(n.getMonth() - 1);
      return n;
    });
  }
  function miniNext() {
    setMiniDate((d) => {
      const n = new Date(d);
      n.setMonth(n.getMonth() + 1);
      return n;
    });
  }

  const miniBirthdays = useMemo(() => {
    return getBirthdaysForYear(birthdays, miniDate.getFullYear(), today);
  }, [birthdays, miniDate, today]);

  // Week label
  const weekLabel = useMemo(() => {
    const days = getWeekDays(viewDate);
    const start = days[0];
    const end = days[6];
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
  }, [viewDate]);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1f1f1f] pb-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-[#cc0000] shrink-0" />
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#e8e8e8] flex items-center gap-2.5">
              CALENDAR
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#6b7280]" />}
            </h2>
            <p className="text-sm text-[#9aa1ad] mt-0.5">
              Schedule team events, meetings, deadlines, and member birthdays.
            </p>
          </div>
        </div>

        {/* Storage status badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {syncSource === "supabase" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Supabase Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-[#0a0a0a] text-[#9aa1ad] border border-[#2a2a2a]" title="Data stored locally until Supabase migration SQL is applied">
              <Database className="w-3 h-3 text-[#6b7280]" />
              Local Storage Mirror
            </span>
          )}
        </div>
      </div>

      {/* Database Setup Notice if applicable */}
      {dbNotice && (
        <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-amber-300">Supabase Setup Notice: </span>
            {dbNotice}
          </div>
        </div>
      )}

      {/* 2. TOOLBAR AND FILTER CHIPS */}
      <CalendarToolbar
        view={view}
        viewDate={viewDate}
        search={search}
        categoryFilter={categoryFilter}
        onViewChange={setView}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={goToday}
        onSearchChange={setSearch}
        onCategoryChange={setCategoryFilter}
        onAddEvent={openAddEventBlank}
        onAddBirthday={() => {
          setEditingBirthday(null);
          setAddBirthdayOpen(true);
        }}
        onMonthChange={handleMonthChange}
        onYearChange={handleYearChange}
        counts={typeCounts}
        totalCount={totalItemCount}
      />

      {/* Week label (week view only) */}
      {view === "week" && (
        <p className="text-xs font-bold uppercase tracking-widest text-[#9aa1ad]">
          {weekLabel}
        </p>
      )}

      {/* Calendar Views Layout */}
      {view === "month" ? (
        /* 1. MONTH GRID (main view full-width top-to-bottom layout) */
        <div className="space-y-4">
          <MonthView
            viewDate={viewDate}
            selectedDate={selectedDate}
            today={today}
            events={filteredEvents}
            birthdays={filteredBirthdays}
            onSelectDate={handleSelectDate}
            onEventClick={setViewingEvent}
            onBirthdayClick={setViewingBirthday}
            onAddEventOnDate={openAddEventOnDate}
          />

          {/* 3. SELECTED-DAY PANEL (below the grid) */}
          <div className="border border-[#1f1f1f] bg-[#050505] flex flex-col md:flex-row">
            {/* Left: 1fr summary */}
            <div className="p-4 flex-1 border-b md:border-b-0 md:border-r border-[#1f1f1f] flex flex-col justify-between space-y-3">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280]">
                  SELECTED DAY
                </span>
                <h3 className="text-[22px] font-bold uppercase tracking-[0.08em] text-[#e8e8e8] mt-0.5">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()} {selectedDate.getDate()}
                </h3>
                <p className="text-[11px] text-[#f5b301] mt-0.5">
                  {getRelativeDayString(selectedDate, today)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openAddEventOnDate(selectedDate)}
                className="w-full bg-[#cc0000] text-white py-2 px-3 text-[11px] font-bold uppercase tracking-[0.07em] hover:bg-[#aa0000] transition cursor-pointer"
              >
                + ADD TO THIS DAY
              </button>
            </div>

            {/* Right: 1.3fr agenda list */}
            <div className="p-4 flex-[1.3] flex flex-col">
              <span className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-2">
                AGENDA - {selectedDayItems.length} {selectedDayItems.length === 1 ? "ITEM" : "ITEMS"}
              </span>

              {selectedDayItems.length === 0 ? (
                <div className="flex-1 flex items-center text-xs text-[#6b7280] italic py-4">
                  Nothing scheduled
                </div>
              ) : (
                <div className="divide-y divide-[#1a1a1a] flex-1">
                  {selectedDayItems.map((item) => {
                    if (item.type === "birthday") {
                      const b = item.data;
                      return (
                        <div
                          key={`sel-bday-${b.record.id}`}
                          onClick={() => setViewingBirthday(b)}
                          className="py-2.5 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] px-1 transition"
                        >
                          <div
                            className="w-[3px] self-stretch shrink-0"
                            style={{ backgroundColor: "#f5b301" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-[#e8e8e8] font-medium truncate">
                              {b.record.name}
                            </p>
                            <p className="text-[10px] text-[#6b7280] uppercase tracking-[0.07em] mt-0.5">
                              BIRTHDAY · ALL DAY
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const ev = item.data;
                    const timeText = ev.startTime ? formatTime12(ev.startTime) : "ALL DAY";
                    return (
                      <div
                        key={`sel-ev-${ev.id}`}
                        onClick={() => setViewingEvent(ev)}
                        className="py-2.5 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] px-1 transition"
                      >
                        <div
                          className="w-[3px] self-stretch shrink-0"
                          style={{ backgroundColor: getTypeColorHex(ev.category) }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-[#e8e8e8] font-medium truncate">
                            {ev.title}
                          </p>
                          <p className="text-[10px] text-[#6b7280] uppercase tracking-[0.07em] mt-0.5">
                            {ev.category} - {timeText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Week and Day views layout: MiniCalendar sidebar + View + Selected Day Panel */
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="w-full lg:w-56 shrink-0 space-y-3">
              <MiniCalendar
                viewDate={miniDate}
                selectedDate={selectedDate}
                today={today}
                events={events}
                birthdays={miniBirthdays}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                  setViewDate(new Date(date));
                  setMiniDate(new Date(date));
                }}
                onPrev={miniPrev}
                onNext={miniNext}
              />
            </div>

            <div className="flex-1 min-w-0 w-full">
              {view === "week" && (
                <WeekView
                  viewDate={viewDate}
                  selectedDate={selectedDate}
                  today={today}
                  events={filteredEvents}
                  birthdays={filteredBirthdays}
                  onSelectDate={(date) => {
                    setSelectedDate(date);
                    setView("day");
                    setViewDate(new Date(date));
                  }}
                  onEventClick={setViewingEvent}
                  onBirthdayClick={setViewingBirthday}
                  onAddEventOnDate={openAddEventOnDate}
                />
              )}
              {view === "day" && (
                <DayView
                  viewDate={viewDate}
                  today={today}
                  events={filteredEvents}
                  birthdays={filteredBirthdays}
                  onEventClick={setViewingEvent}
                  onBirthdayClick={setViewingBirthday}
                  onAddEvent={openAddEventBlank}
                />
              )}
            </div>
          </div>

          {/* Selected-Day Panel below Week/Day view as well */}
          <div className="border border-[#1f1f1f] bg-[#050505] flex flex-col md:flex-row">
            <div className="p-4 flex-1 border-b md:border-b-0 md:border-r border-[#1f1f1f] flex flex-col justify-between space-y-3">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280]">
                  SELECTED DAY
                </span>
                <h3 className="text-[22px] font-bold uppercase tracking-[0.08em] text-[#e8e8e8] mt-0.5">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()} {selectedDate.getDate()}
                </h3>
                <p className="text-[11px] text-[#f5b301] mt-0.5">
                  {getRelativeDayString(selectedDate, today)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openAddEventOnDate(selectedDate)}
                className="w-full bg-[#cc0000] text-white py-2 px-3 text-[11px] font-bold uppercase tracking-[0.07em] hover:bg-[#aa0000] transition cursor-pointer"
              >
                + ADD TO THIS DAY
              </button>
            </div>

            <div className="p-4 flex-[1.3] flex flex-col">
              <span className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-2">
                AGENDA - {selectedDayItems.length} {selectedDayItems.length === 1 ? "ITEM" : "ITEMS"}
              </span>

              {selectedDayItems.length === 0 ? (
                <div className="flex-1 flex items-center text-xs text-[#6b7280] italic py-4">
                  Nothing scheduled
                </div>
              ) : (
                <div className="divide-y divide-[#1a1a1a] flex-1">
                  {selectedDayItems.map((item) => {
                    if (item.type === "birthday") {
                      const b = item.data;
                      return (
                        <div
                          key={`sel-bday-${b.record.id}`}
                          onClick={() => setViewingBirthday(b)}
                          className="py-2.5 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] px-1 transition"
                        >
                          <div
                            className="w-[3px] self-stretch shrink-0"
                            style={{ backgroundColor: "#f5b301" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-[#e8e8e8] font-medium truncate">
                              {b.record.name}
                            </p>
                            <p className="text-[10px] text-[#6b7280] uppercase tracking-[0.07em] mt-0.5">
                              BIRTHDAY · ALL DAY
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const ev = item.data;
                    const timeText = ev.startTime ? formatTime12(ev.startTime) : "ALL DAY";
                    return (
                      <div
                        key={`sel-ev-${ev.id}`}
                        onClick={() => setViewingEvent(ev)}
                        className="py-2.5 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] px-1 transition"
                      >
                        <div
                          className="w-[3px] self-stretch shrink-0"
                          style={{ backgroundColor: getTypeColorHex(ev.category) }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-[#e8e8e8] font-medium truncate">
                            {ev.title}
                          </p>
                          <p className="text-[10px] text-[#6b7280] uppercase tracking-[0.07em] mt-0.5">
                            {ev.category} - {timeText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {viewingEvent && !editingEvent && (
        <EventModal
          event={viewingEvent}
          onClose={() => setViewingEvent(null)}
          onEdit={openEditEvent}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Event Form Modal (Add/Edit) */}
      {(addEventOpen || editingEvent) && (
        <EventFormModal
          initialEvent={editingEvent ?? undefined}
          prefillDate={prefillDate}
          events={events}
          birthdays={birthdays}
          onClose={() => {
            setAddEventOpen(false);
            setEditingEvent(null);
            setPrefillDate(undefined);
          }}
          onSave={editingEvent ? handleUpdateEvent : handleAddEvent}
        />
      )}

      {/* Birthday Details Modal */}
      {viewingBirthday && !editingBirthday && (
        <BirthdayModal
          occurrence={viewingBirthday}
          onClose={() => setViewingBirthday(null)}
          onEdit={openEditBirthday}
          onDelete={handleDeleteBirthday}
        />
      )}

      {/* Birthday Form Modal (Add/Edit) */}
      {(addBirthdayOpen || editingBirthday) && (
        <BirthdayFormModal
          initialBirthday={editingBirthday ?? undefined}
          onClose={() => {
            setAddBirthdayOpen(false);
            setEditingBirthday(null);
          }}
          onSave={editingBirthday ? handleUpdateBirthday : handleAddBirthday}
        />
      )}
    </div>
  );
}
