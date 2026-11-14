"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Cake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  BirthdayRecord,
  getDaysInMonth,
  isSameDay,
  toDateStr,
  getBirthdaysForYear,
} from "@/lib/calendar-storage";

export interface CustomDatePickerProps {
  value: string; // "yyyy-mm-dd"
  onChange: (dateStr: string) => void;
  min?: string; // "yyyy-mm-dd"
  max?: string; // "yyyy-mm-dd"
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  events?: CalendarEvent[];
  birthdays?: BirthdayRecord[];
  /** Start year for the year dropdown. Defaults to 1920 (for birthdays) or CURRENT - 5 */
  minYear?: number;
  /** End year for the year dropdown. Defaults to CURRENT + 15 */
  maxYear?: number;
  id?: string;
  className?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CustomDatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  error = false,
  disabled = false,
  events = [],
  birthdays = [],
  minYear = 1920,
  maxYear = new Date().getFullYear() + 15,
  id,
  className = "",
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const todayStr = toDateStr(today);

  // Initialize view month/year from initial value if valid, else today
  const initialDate = (() => {
    if (value) {
      const [y, m, d] = value.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m - 1, d);
      }
    }
    return today;
  })();

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When value changes from outside, keep view in sync if open
  useEffect(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [value]);

  // Position calculation with viewport bounding
  useLayoutEffect(() => {
    if (!open) return;
    function updateCoords() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popupWidth = Math.max(rect.width, 280);
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 12) {
        left = window.innerWidth - popupWidth - 12;
      }
      if (left < 12) left = 12;

      // Check if popup fits below, otherwise show above
      const spaceBelow = window.innerHeight - rect.bottom;
      const popupHeight = 340;
      let top = rect.bottom + 4;
      if (spaceBelow < popupHeight && rect.top > popupHeight) {
        top = rect.top - popupHeight - 4;
      }

      setCoords({ top, left, width: popupWidth });
    }

    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [open]);

  // Outside click & Escape key dismiss
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDate(dateStr: string) {
    onChange(dateStr);
    setOpen(false);
  }

  function handleJumpToday() {
    const ds = toDateStr(today);
    if ((!min || ds >= min) && (!max || ds <= max)) {
      onChange(ds);
    }
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setOpen(false);
  }

  // Pre-calculate days of month
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDow = daysInMonth[0].getDay();
  const emptyLeadingCells = Array.from({ length: firstDow });

  // Map events for indicator
  const eventDateSet = new Set(
    events.flatMap((e) => {
      const dates: string[] = [];
      const [sy, sm, sd] = e.startDate.split("-").map(Number);
      const [ey, em, ed] = e.endDate.split("-").map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      const cur = new Date(start);
      while (cur <= end) {
        dates.push(toDateStr(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return dates;
    })
  );

  // Map birthdays for current view year
  const birthdayOccurrences = getBirthdaysForYear(birthdays, viewYear, today);
  const birthdayDateSet = new Set(birthdayOccurrences.map((b) => b.dateStr));

  // Generate year options from maxYear down to minYear
  const yearOptions: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    yearOptions.push(y);
  }

  // Display label for trigger button
  const displayLabel = (() => {
    if (!value) return placeholder;
    const [y, m, d] = value.split("-").map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return placeholder;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  })();

  return (
    <div ref={rootRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2 bg-white/5 border px-3 py-2 text-sm text-left transition outline-none cursor-pointer",
          error
            ? "border-red text-white"
            : open
            ? "border-white/40 text-white"
            : "border-white/10 text-white hover:border-white/30",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={cn("truncate", !value && "text-gray-500")}>
          {displayLabel}
        </span>
        <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {/* Portaled Popup */}
      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 9999,
            }}
            className="border border-white/10 bg-black p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            {/* Top Toolbar: Month & Year Selectors with navigation */}
            <div className="flex items-center justify-between gap-1 mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1.5 flex-1 justify-center">
                {/* Month Dropdown */}
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="bg-black border border-white/10 text-white text-xs font-bold uppercase tracking-wider px-2 py-1 outline-none hover:border-white/30 transition cursor-pointer"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx} className="bg-black text-white">
                      {name}
                    </option>
                  ))}
                </select>

                {/* Quick Year Dropdown (Allows quick jump to any older birth year) */}
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="bg-black border border-white/10 text-white text-xs font-bold tracking-wider px-2 py-1 outline-none hover:border-white/30 transition cursor-pointer"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y} className="bg-black text-white">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition"
                aria-label="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1 text-center">
              {WEEKDAY_SHORT.map((wd) => (
                <div
                  key={wd}
                  className="text-[10px] font-bold uppercase tracking-widest text-gray-500 py-0.5"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {emptyLeadingCells.map((_, i) => (
                <div key={`empty-${i}`} className="h-7 w-full" />
              ))}

              {daysInMonth.map((day) => {
                const ds = toDateStr(day);
                const isSelected = value === ds;
                const isToday = todayStr === ds;
                const hasEvent = eventDateSet.has(ds);
                const hasBirthday = birthdayDateSet.has(ds);

                const isDisabled = Boolean(
                  (min && ds < min) ||
                  (max && ds > max)
                );

                return (
                  <button
                    key={ds}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDate(ds)}
                    className={cn(
                      "relative flex flex-col items-center justify-center h-7 w-full text-xs font-medium transition",
                      isDisabled && "opacity-25 cursor-not-allowed hover:bg-transparent",
                      !isDisabled && isSelected && !isToday && "bg-white/20 text-white ring-1 ring-white/50",
                      !isDisabled && isToday && "bg-red text-white font-black",
                      !isDisabled && !isSelected && !isToday && "text-gray-300 hover:bg-white/10",
                      !isDisabled && isSelected && isToday && "bg-red text-white font-black ring-1 ring-white"
                    )}
                  >
                    <span>{day.getDate()}</span>

                    {/* Indicator dots */}
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                      {hasBirthday && !isToday && (
                        <span className="w-1 h-1 bg-amber-400 rounded-none shrink-0" />
                      )}
                      {hasEvent && !isToday && (
                        <span className="w-1 h-1 bg-red rounded-none shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer with Today shortcut and Legend */}
            <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-gray-500 text-[10px]">
                {events.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red inline-block" /> Event
                  </span>
                )}
                {birthdays.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-400 inline-block" /> Birthday
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleJumpToday}
                  className="px-2 py-0.5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white hover:border-white/30 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Today
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
