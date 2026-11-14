"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Cake,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EventCategory,
  EVENT_CATEGORIES,
  formatMonthYear,
} from "@/lib/calendar-storage";
import toast from "react-hot-toast";

export type CalendarView = "month" | "week" | "day";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 2 + i);

interface CalendarToolbarProps {
  view: CalendarView;
  viewDate: Date;
  search: string;
  categoryFilter: EventCategory | "";
  onViewChange: (v: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSearchChange: (s: string) => void;
  onCategoryChange: (c: EventCategory | "") => void;
  onAddEvent: () => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

export default function CalendarToolbar({
  view,
  viewDate,
  search,
  categoryFilter,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onSearchChange,
  onCategoryChange,
  onAddEvent,
  onMonthChange,
  onYearChange,
}: CalendarToolbarProps) {
  const views: { key: CalendarView; label: string }[] = [
    { key: "month", label: "Month" },
    { key: "week",  label: "Week" },
    { key: "day",   label: "Day" },
  ];

  function handleAddBirthday() {
    toast("Birthday management coming in Part 2.", {
      icon: "🎂",
      style: {
        background: "#1f2937",
        color: "#fcd34d",
        border: "1px solid #d97706",
      },
    });
  }

  return (
    <div className="space-y-3">
      {/* Row 1 — Navigation + View switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Prev / Today / Next */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            className="p-2 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onToday}
            className="px-3 py-1.5 border border-white/10 text-xs font-bold uppercase tracking-widest text-gray-300 hover:text-white hover:border-white/30 transition"
          >
            Today
          </button>
          <button
            onClick={onNext}
            className="p-2 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month / Year selectors */}
        <div className="flex items-center gap-1.5">
          <select
            value={viewDate.getMonth()}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="bg-black border border-white/10 text-white text-xs font-bold uppercase tracking-widest px-2 py-1.5 outline-none hover:border-white/30 transition appearance-none cursor-pointer"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i} className="bg-black text-white normal-case">
                {m}
              </option>
            ))}
          </select>
          <select
            value={viewDate.getFullYear()}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="bg-black border border-white/10 text-white text-xs font-bold uppercase tracking-widest px-2 py-1.5 outline-none hover:border-white/30 transition appearance-none cursor-pointer"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y} className="bg-black text-white">
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Title (hidden on small screens when selectors visible) */}
        <span className="hidden md:block flex-1 text-sm font-bold uppercase tracking-widest text-white">
          {view === "day"
            ? ""
            : formatMonthYear(viewDate)}
        </span>

        {/* View tabs */}
        <div className="flex border border-white/10 ml-auto">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => onViewChange(v.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition border-r border-white/10 last:border-r-0",
                view === v.key
                  ? "bg-red text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2 — Search + Category filter + Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-black border border-white/10 pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value as EventCategory | "")}
          className="bg-black border border-white/10 text-xs text-gray-300 px-2 py-1.5 outline-none hover:border-white/30 transition appearance-none cursor-pointer"
        >
          <option value="" className="bg-black">All Categories</option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c} className="bg-black">
              {c}
            </option>
          ))}
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add Birthday — placeholder, styled but opens toast */}
        <button
          onClick={handleAddBirthday}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-widest hover:bg-amber-500/10 hover:border-amber-500/60 transition"
          aria-label="Add Birthday"
        >
          <Cake className="w-3.5 h-3.5" />
          Add Birthday
        </button>

        {/* Add Event — fully functional */}
        <button
          onClick={onAddEvent}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red text-white text-xs font-bold uppercase tracking-widest hover:bg-red/80 transition"
          aria-label="Add Event"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Event
        </button>
      </div>
    </div>
  );
}
