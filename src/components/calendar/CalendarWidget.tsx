"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays } from "lucide-react";

import {
  CalendarEvent,
  EventCategory,
  NewCalendarEvent,
  calendarStorage,
  getWeekDays,
  isSameDay,
  toDateStr,
} from "@/lib/calendar-storage";

import CalendarToolbar, { CalendarView } from "./CalendarToolbar";
import MiniCalendar from "./MiniCalendar";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import EventModal from "./EventModal";
import EventFormModal from "./EventFormModal";

export default function CalendarWidget() {
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<CalendarView>("month");
  const [viewDate, setViewDate] = useState<Date>(new Date(today));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(today));
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Modals
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);

  // Filtering
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "">("");

  // Load from localStorage on mount
  useEffect(() => {
    setEvents(calendarStorage.getAll());
  }, []);

  // ─── Filtered events for display ─────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        !search ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.location.toLowerCase().includes(search.toLowerCase());
      const matchesCat = !categoryFilter || e.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [events, search, categoryFilter]);

  // ─── Navigation ──────────────────────────────────────────────────────────
  function navigate(direction: 1 | -1) {
    setViewDate((prev) => {
      const d = new Date(prev);
      if (view === "month") {
        d.setMonth(d.getMonth() + direction);
      } else if (view === "week") {
        d.setDate(d.getDate() + direction * 7);
      } else {
        d.setDate(d.getDate() + direction);
      }
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

  // Keep viewDate in sync when user picks a date in mini calendar or month cells
  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setViewDate(new Date(date));
    if (view === "month") {
      setView("day");
    }
  }

  // ─── Event CRUD ──────────────────────────────────────────────────────────
  const handleAddEvent = useCallback((data: NewCalendarEvent) => {
    const ev = calendarStorage.add(data);
    setEvents(calendarStorage.getAll());
    setAddFormOpen(false);
    setEditingEvent(null);
    setPrefillDate(undefined);
    toast.success(`"${ev.title}" added to calendar.`);
  }, []);

  const handleUpdateEvent = useCallback((data: NewCalendarEvent) => {
    if (!editingEvent) return;
    calendarStorage.update(editingEvent.id, data);
    setEvents(calendarStorage.getAll());
    setEditingEvent(null);
    setViewingEvent(null);
    toast.success("Event updated.");
  }, [editingEvent]);

  const handleDeleteEvent = useCallback((id: string) => {
    const ev = events.find((e) => e.id === id);
    calendarStorage.delete(id);
    setEvents(calendarStorage.getAll());
    setViewingEvent(null);
    toast.success(`"${ev?.title ?? "Event"}" deleted.`);
  }, [events]);

  function openAddOnDate(date: Date) {
    setPrefillDate(toDateStr(date));
    setAddFormOpen(true);
  }

  function openAddBlank() {
    setPrefillDate(undefined);
    setAddFormOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditingEvent(event);
    setViewingEvent(null);
  }

  // ─── Mini-calendar nav (independent from main view) ──────────────────────
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

  // ─── Week label for header ────────────────────────────────────────────────
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
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <CalendarDays className="w-6 h-6 text-red shrink-0" />
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Calendar
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Schedule and track team events, meetings, deadlines and more.
          </p>
        </div>
      </div>

      {/* Toolbar */}
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
        onAddEvent={openAddBlank}
        onMonthChange={handleMonthChange}
        onYearChange={handleYearChange}
      />

      {/* Week label (week view only) */}
      {view === "week" && (
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {weekLabel}
        </p>
      )}

      {/* Main layout: sidebar + calendar view */}
      <div className="flex gap-4 items-start">
        {/* Mini calendar sidebar — hidden on small screens */}
        <div className="hidden lg:block w-52 shrink-0">
          <MiniCalendar
            viewDate={miniDate}
            selectedDate={selectedDate}
            today={today}
            events={filteredEvents}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setViewDate(new Date(date));
              setMiniDate(new Date(date));
            }}
            onPrev={miniPrev}
            onNext={miniNext}
          />

          {/* Category legend */}
          <div className="mt-3 border border-white/10 bg-black p-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
              Categories
            </p>
            {[
              { label: "Meeting",      dot: "bg-blue-400" },
              { label: "Competition",  dot: "bg-red" },
              { label: "Workshop",     dot: "bg-violet-400" },
              { label: "Deadline",     dot: "bg-amber-400" },
              { label: "Team Activity",dot: "bg-emerald-400" },
              { label: "Other",        dot: "bg-gray-400" },
            ].map(({ label, dot }) => (
              <button
                key={label}
                onClick={() =>
                  setCategoryFilter((prev) =>
                    prev === label ? "" : (label as EventCategory)
                  )
                }
                className={`flex items-center gap-2 text-xs w-full text-left transition ${
                  categoryFilter === label ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <span className={`w-2 h-2 shrink-0 ${dot}`} />
                {label}
              </button>
            ))}
          </div>

          {/* Event count */}
          <div className="mt-3 border border-white/10 bg-black px-3 py-2 text-xs text-gray-500">
            {filteredEvents.length}{" "}
            {filteredEvents.length === 1 ? "event" : "events"}
            {(search || categoryFilter) && " (filtered)"}
          </div>
        </div>

        {/* Calendar view */}
        <div className="flex-1 min-w-0">
          {view === "month" && (
            <MonthView
              viewDate={viewDate}
              selectedDate={selectedDate}
              today={today}
              events={filteredEvents}
              onSelectDate={handleSelectDate}
              onEventClick={setViewingEvent}
              onAddEventOnDate={openAddOnDate}
            />
          )}
          {view === "week" && (
            <WeekView
              viewDate={viewDate}
              selectedDate={selectedDate}
              today={today}
              events={filteredEvents}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setView("day");
                setViewDate(new Date(date));
              }}
              onEventClick={setViewingEvent}
              onAddEventOnDate={openAddOnDate}
            />
          )}
          {view === "day" && (
            <DayView
              viewDate={viewDate}
              today={today}
              events={filteredEvents}
              onEventClick={setViewingEvent}
              onAddEvent={openAddBlank}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {viewingEvent && !editingEvent && (
        <EventModal
          event={viewingEvent}
          onClose={() => setViewingEvent(null)}
          onEdit={openEdit}
          onDelete={handleDeleteEvent}
        />
      )}

      {(addFormOpen || editingEvent) && (
        <EventFormModal
          initialEvent={editingEvent ?? undefined}
          prefillDate={prefillDate}
          onClose={() => {
            setAddFormOpen(false);
            setEditingEvent(null);
            setPrefillDate(undefined);
          }}
          onSave={editingEvent ? handleUpdateEvent : handleAddEvent}
        />
      )}
    </div>
  );
}
