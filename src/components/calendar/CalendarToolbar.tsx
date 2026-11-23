"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Cake,
  Check,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EventCategory,
  EVENT_CATEGORIES,
} from "@/lib/calendar-storage";

export type CalendarView = "month" | "week" | "day";
export type FilterType = EventCategory | "Birthdays" | "";

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const FILTER_ITEMS: Array<{ key: FilterType; label: string; color: string }> = [
  { key: "Birthdays", label: "Birthdays", color: "#f5b301" },
  { key: "Meeting", label: "Meeting", color: "#5b9cf5" },
  { key: "Competition", label: "Competition", color: "#cc0000" },
  { key: "Workshop", label: "Workshop", color: "#a78bfa" },
  { key: "Deadline", label: "Deadline", color: "#fb923c" },
  { key: "Team Activity", label: "Team Activity", color: "#34d399" },
  { key: "Other", label: "Other", color: "#9ca3af" },
];

export interface CalendarToolbarProps {
  view: CalendarView;
  viewDate: Date;
  search: string;
  categoryFilter: FilterType;
  onViewChange: (v: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSearchChange: (s: string) => void;
  onCategoryChange: (c: FilterType) => void;
  onAddEvent: () => void;
  onAddBirthday: () => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  counts?: Record<string, number>;
  totalCount?: number;
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
  onAddBirthday,
  onMonthChange,
  onYearChange,
  counts = {},
  totalCount = 0,
}: CalendarToolbarProps) {
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const monthRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);

  const currentYear = viewDate.getFullYear();
  const currentMonthIdx = viewDate.getMonth();
  const monthName = MONTH_NAMES[currentMonthIdx];

  // 12-year grid range: e.g. [currentYear - 5 ... currentYear + 6]
  const startYear = currentYear - 5;
  const yearGrid = Array.from({ length: 12 }, (_, i) => startYear + i);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (monthRef.current && !monthRef.current.contains(e.target as Node)) {
        setMonthDropdownOpen(false);
      }
      if (yearRef.current && !yearRef.current.contains(e.target as Node)) {
        setYearDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const views: { key: CalendarView; label: string }[] = [
    { key: "month", label: "MONTH" },
    { key: "week", label: "WEEK" },
    { key: "day", label: "DAY" },
  ];

  return (
    <div className="space-y-2 select-none">
      {/* Row 1 — [<] [TODAY] [>]  NOVEMBER 2026                      [MONTH][WEEK][DAY] */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Navigation group + unified Month/Year title */}
        <div className="flex items-center gap-3">
          {/* [<] [TODAY] [>] group */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              className="w-7 h-7 flex items-center justify-center border border-[#2a2a2a] bg-black text-[#9aa1ad] hover:text-white hover:border-[#444] transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="h-7 px-3 border border-[#2a2a2a] bg-black text-[11px] font-bold uppercase tracking-[0.07em] text-[#e8e8e8] hover:text-white hover:border-[#444] transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
              aria-label="Go to today"
            >
              TODAY
            </button>
            <button
              type="button"
              onClick={onNext}
              className="w-7 h-7 flex items-center justify-center border border-[#2a2a2a] bg-black text-[#9aa1ad] hover:text-white hover:border-[#444] transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
              aria-label="Next month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ONE title text: "NOVEMBER 2026" with optional quick selectors */}
          <div className="flex items-center gap-1.5 relative">
            <div ref={monthRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setMonthDropdownOpen((p) => !p);
                  setYearDropdownOpen(false);
                }}
                className="flex items-center gap-1 text-[15px] font-bold uppercase tracking-[0.1em] text-[#e8e8e8] hover:text-white transition"
              >
                <span>{monthName}</span>
                <ChevronDown className="w-3 h-3 text-[#6b7280]" />
              </button>

              {/* Month Dropdown */}
              {monthDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-36 max-h-[176px] overflow-y-auto bg-[#0a0a0a] border border-[#2a2a2a] z-50 shadow-2xl divide-y divide-[#151515]">
                  {MONTH_NAMES.map((name, idx) => {
                    const isSelected = idx === currentMonthIdx;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          onMonthChange(idx);
                          setMonthDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.07em] flex items-center justify-between transition",
                          isSelected
                            ? "bg-[#1a0505] text-white border-l-2 border-[#cc0000]"
                            : "text-[#9aa1ad] hover:text-white hover:bg-[#141414]"
                        )}
                      >
                        <span>{name}</span>
                        {isSelected && <Check className="w-3 h-3 text-[#cc0000]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div ref={yearRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setYearDropdownOpen((p) => !p);
                  setMonthDropdownOpen(false);
                }}
                className="flex items-center gap-1 text-[15px] font-bold uppercase tracking-[0.1em] text-[#e8e8e8] hover:text-white transition"
              >
                <span>{currentYear}</span>
                <ChevronDown className="w-3 h-3 text-[#6b7280]" />
              </button>

              {/* Year Dropdown Grid */}
              {yearDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-[#0a0a0a] border border-[#2a2a2a] z-50 shadow-2xl">
                  <div className="grid grid-cols-3 gap-1">
                    {yearGrid.map((yr) => {
                      const isSelected = yr === currentYear;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            onYearChange(yr);
                            setYearDropdownOpen(false);
                          }}
                          className={cn(
                            "py-1 text-center text-[11px] font-bold tracking-[0.07em] transition",
                            isSelected
                              ? "bg-[#cc0000] text-white"
                              : "text-[#9aa1ad] hover:text-white hover:bg-[#1a1a1a]"
                          )}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: [MONTH][WEEK][DAY] toggle */}
        <div className="flex border border-[#2a2a2a] bg-black">
          {views.map((v) => {
            const isActive = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => onViewChange(v.key)}
                className={cn(
                  "px-3 py-1 text-[11px] font-bold uppercase tracking-[0.07em] transition border-r border-[#2a2a2a] last:border-r-0",
                  isActive
                    ? "bg-[#cc0000] text-white"
                    : "bg-black text-[#9aa1ad] hover:text-white hover:bg-[#111]"
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2 — Search field (flex 1) [+ BIRTHDAY] [+ EVENT] */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b7280] pointer-events-none" />
          <input
            type="text"
            placeholder="Search events and birthdays..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#000000] border border-[#2a2a2a] pl-9 pr-3 py-1.5 text-xs text-[#e8e8e8] placeholder-[#6b7280] outline-none focus:border-[#444] transition"
          />
        </div>

        {/* [+ BIRTHDAY] — Yellow text, yellow 1px border, transparent background */}
        <button
          type="button"
          onClick={onAddBirthday}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#f5b301] bg-transparent text-[#f5b301] text-[10px] font-bold uppercase tracking-[0.07em] hover:bg-[#f5b30115] transition cursor-pointer shrink-0"
          aria-label="Add Birthday"
        >
          <Cake className="w-3.5 h-3.5" />
          + BIRTHDAY
        </button>

        {/* [+ EVENT] — Solid red, white text */}
        <button
          type="button"
          onClick={onAddEvent}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#cc0000] text-white text-[10px] font-bold uppercase tracking-[0.07em] hover:bg-[#aa0000] transition cursor-pointer shrink-0"
          aria-label="Add Event"
        >
          <Plus className="w-3.5 h-3.5" />
          + EVENT
        </button>
      </div>

      {/* Row 3 — Horizontal wrapping row of chips + Live counts + Total items */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {FILTER_ITEMS.map(({ key, label, color }) => {
          const isActive = categoryFilter === key;
          const count = counts[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onCategoryChange(isActive ? "" : key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-[9px] py-[4px] border text-[10px] uppercase tracking-[0.07em] transition cursor-pointer",
                isActive
                  ? "border-[#cc0000] bg-[#1a0505]"
                  : "border-[#2a2a2a] bg-black hover:border-[#444]"
              )}
            >
              <span
                className="w-2 h-2 shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className={isActive ? "text-white font-bold" : "text-[#9aa1ad]"}>
                {label}
              </span>
              <span className="text-[#e8e8e8] font-bold ml-0.5">
                {count}
              </span>
            </button>
          );
        })}

        {/* Total items right-aligned */}
        <div className="ml-auto text-[11px] text-[#6b7280] uppercase tracking-[0.07em] font-medium pl-2">
          {totalCount} {totalCount === 1 ? "item" : "items"}
        </div>
      </div>
    </div>
  );
}
