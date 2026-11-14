"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, Cake } from "lucide-react";

import {
  CalendarEvent,
  EventCategory,
  NewCalendarEvent,
  BirthdayRecord,
  NewBirthdayRecord,
  BirthdayOccurrence,
  calendarStorage,
  birthdayStorage,
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

export default function CalendarWidget() {
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<CalendarView>("month");
  const [viewDate, setViewDate] = useState<Date>(new Date(today));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(today));

  // Data states
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayRecord[]>([]);

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

  // Load from localStorage on mount
  useEffect(() => {
    setEvents(calendarStorage.getAll());
    setBirthdays(birthdayStorage.getAll());
  }, []);

  // ─── Calculate Birthday Occurrences for current view year ──────────────────
  const activeYear = viewDate.getFullYear();
  const yearlyBirthdays = useMemo(() => {
    return getBirthdaysForYear(birthdays, activeYear, today);
  }, [birthdays, activeYear, today]);

  // ─── Filtered Events ───────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    // If filter is strictly "Birthdays", hide all events
    if (categoryFilter === "Birthdays") return [];

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

  // ─── Filtered Birthdays ────────────────────────────────────────────────────
  const filteredBirthdays = useMemo(() => {
    // If filter is set to a non-empty event category (e.g. "Meeting"), hide birthdays
    if (categoryFilter && categoryFilter !== "Birthdays") return [];

    return yearlyBirthdays.filter((b) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        b.record.name.toLowerCase().includes(q) ||
        (b.record.description && b.record.description.toLowerCase().includes(q))
      );
    });
  }, [yearlyBirthdays, search, categoryFilter]);

  // ─── Navigation ────────────────────────────────────────────────────────────
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

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setViewDate(new Date(date));
    if (view === "month") {
      setView("day");
    }
  }

  // ─── Event CRUD Handlers ───────────────────────────────────────────────────
  const handleAddEvent = useCallback((data: NewCalendarEvent) => {
    const ev = calendarStorage.add(data);
    setEvents(calendarStorage.getAll());
    setAddEventOpen(false);
    setEditingEvent(null);
    setPrefillDate(undefined);
    toast.success(`Event "${ev.title}" added to calendar.`);
  }, []);

  const handleUpdateEvent = useCallback((data: NewCalendarEvent) => {
    if (!editingEvent) return;
    calendarStorage.update(editingEvent.id, data);
    setEvents(calendarStorage.getAll());
    setEditingEvent(null);
    setViewingEvent(null);
    toast.success("Event updated successfully.");
  }, [editingEvent]);

  const handleDeleteEvent = useCallback((id: string) => {
    const ev = events.find((e) => e.id === id);
    calendarStorage.delete(id);
    setEvents(calendarStorage.getAll());
    setViewingEvent(null);
    toast.success(`Event "${ev?.title ?? "Event"}" deleted.`);
  }, [events]);

  function openAddEventOnDate(date: Date) {
    setPrefillDate(toDateStr(date));
    setAddEventOpen(true);
  }

  function openAddEventBlank() {
    setPrefillDate(undefined);
    setAddEventOpen(true);
  }

  function openEditEvent(event: CalendarEvent) {
    setEditingEvent(event);
    setViewingEvent(null);
  }

  // ─── Birthday CRUD Handlers ────────────────────────────────────────────────
  const handleAddBirthday = useCallback((data: NewBirthdayRecord) => {
    const bday = birthdayStorage.add(data);
    setBirthdays(birthdayStorage.getAll());
    setAddBirthdayOpen(false);
    setEditingBirthday(null);
    toast.success(`Birthday for ${bday.name} saved!`, {
      icon: "🎂",
      style: {
        background: "#1f2937",
        color: "#fcd34d",
        border: "1px solid #d97706",
      },
    });
  }, []);

  const handleUpdateBirthday = useCallback((data: NewBirthdayRecord) => {
    if (!editingBirthday) return;
    birthdayStorage.update(editingBirthday.id, data);
    setBirthdays(birthdayStorage.getAll());
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

  const handleDeleteBirthday = useCallback((id: string) => {
    const bday = birthdays.find((b) => b.id === id);
    birthdayStorage.delete(id);
    setBirthdays(birthdayStorage.getAll());
    setViewingBirthday(null);
    toast.success(`Birthday for ${bday?.name ?? "Member"} deleted.`);
  }, [birthdays]);

  function openEditBirthday(occ: BirthdayOccurrence) {
    setEditingBirthday(occ.record);
    setViewingBirthday(null);
  }

  // ─── Mini-calendar navigation ──────────────────────────────────────────────
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

  // Mini-calendar birthday occurrences for miniDate's year
  const miniBirthdays = useMemo(() => {
    return getBirthdaysForYear(birthdays, miniDate.getFullYear(), today);
  }, [birthdays, miniDate, today]);

  // ─── Week label for header ────────────────────────────────────────────────
  const weekLabel = useMemo(() => {
    const days = getWeekDays(viewDate);
    const start = days[0];
    const end = days[6];
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
  }, [viewDate]);

  const totalItemCount = filteredEvents.length + filteredBirthdays.length;

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
            Schedule team events, meetings, deadlines, and member birthdays.
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
        onAddEvent={openAddEventBlank}
        onAddBirthday={() => {
          setEditingBirthday(null);
          setAddBirthdayOpen(true);
        }}
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
        <div className="hidden lg:block w-56 shrink-0">
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

          {/* Interactive Categories & Birthdays legend */}
          <div className="mt-3 border border-white/10 bg-black p-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
              Filter by Type
            </p>

            {/* Birthdays Filter Item */}
            <button
              onClick={() =>
                setCategoryFilter((prev) => (prev === "Birthdays" ? "" : "Birthdays"))
              }
              className={`flex items-center justify-between text-xs w-full text-left py-0.5 transition ${
                categoryFilter === "Birthdays"
                  ? "text-amber-300 font-bold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 shrink-0 bg-amber-400" />
                <span className="flex items-center gap-1">
                  Birthdays
                </span>
              </div>
              <span className="text-[10px] text-gray-500">
                {yearlyBirthdays.length}
              </span>
            </button>

            {/* Event Categories */}
            {[
              { label: "Meeting", dot: "bg-blue-400" },
              { label: "Competition", dot: "bg-red" },
              { label: "Workshop", dot: "bg-violet-400" },
              { label: "Deadline", dot: "bg-amber-400" },
              { label: "Team Activity", dot: "bg-emerald-400" },
              { label: "Other", dot: "bg-gray-400" },
            ].map(({ label, dot }) => {
              const count = events.filter((e) => e.category === label).length;
              return (
                <button
                  key={label}
                  onClick={() =>
                    setCategoryFilter((prev) =>
                      prev === label ? "" : (label as EventCategory)
                    )
                  }
                  className={`flex items-center justify-between text-xs w-full text-left py-0.5 transition ${
                    categoryFilter === label ? "text-white font-bold" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 shrink-0 ${dot}`} />
                    <span>{label}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Item count status */}
          <div className="mt-3 border border-white/10 bg-black px-3 py-2 text-xs text-gray-400 flex items-center justify-between">
            <span>
              {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
              {(search || categoryFilter) && " (filtered)"}
            </span>
            {(search || categoryFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("");
                }}
                className="text-[10px] text-red hover:underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Calendar View */}
        <div className="flex-1 min-w-0">
          {view === "month" && (
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
          )}
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
