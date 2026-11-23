"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  BirthdayRecord,
  getDaysInMonth,
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
  minYear?: number;
  maxYear?: number;
  id?: string;
  className?: string;
}

type PickerViewMode = "days" | "months" | "years";

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const MONTH_NAMES_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
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
  id,
  className = "",
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<PickerViewMode>("days");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const todayStr = toDateStr(today);

  // Initialize view from initial value or today
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
  const [focusedDay, setFocusedDay] = useState<number>(initialDate.getDate());
  const [yearGridBase, setYearGridBase] = useState<number>(
    Math.floor(initialDate.getFullYear() / 12) * 12
  );

  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y);
        setViewMonth(m - 1);
        if (!isNaN(d)) setFocusedDay(d);
        setYearGridBase(Math.floor(y / 12) * 12);
      }
    }
  }, [value]);

  // Position popover directly under the field with 4px gap
  useLayoutEffect(() => {
    if (!open) return;
    function updateCoords() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popupWidth = 260;
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 12) {
        left = window.innerWidth - popupWidth - 12;
      }
      if (left < 12) left = 12;

      let top = rect.bottom + 4;
      const popupHeight = 310;
      if (window.innerHeight - rect.bottom < popupHeight && rect.top > popupHeight) {
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
  }, [open, viewMode]);

  // Pre-calculate days of month
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const totalDays = daysInMonth.length;
  const firstDow = daysInMonth[0].getDay();
  const emptyLeadingCells = Array.from({ length: firstDow });

  function selectDate(dateStr: string) {
    onChange(dateStr);
    setOpen(false);
    setViewMode("days");
    triggerRef.current?.focus();
  }

  // Keyboard navigation & Esc/Enter handling
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
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (viewMode === "days") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setFocusedDay((d) => (d > 1 ? d - 1 : 1));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setFocusedDay((d) => (d < totalDays ? d + 1 : totalDays));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setFocusedDay((d) => (d - 7 >= 1 ? d - 7 : d));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setFocusedDay((d) => (d + 7 <= totalDays ? d + 7 : d));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const targetDay = daysInMonth[focusedDay - 1] || daysInMonth[0];
          selectDate(toDateStr(targetDay));
        }
      } else if (viewMode === "months") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setViewMonth((m) => (m > 0 ? m - 1 : 11));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setViewMonth((m) => (m < 11 ? m + 1 : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setViewMonth((m) => (m - 3 >= 0 ? m - 3 : m));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setViewMonth((m) => (m + 3 <= 11 ? m + 3 : m));
        } else if (e.key === "Enter") {
          e.preventDefault();
          setViewMode("days");
        }
      } else if (viewMode === "years") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setViewYear((y) => y - 1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setViewYear((y) => y + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setViewYear((y) => y - 3);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setViewYear((y) => y + 3);
        } else if (e.key === "Enter") {
          e.preventDefault();
          setViewMode("months");
        }
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, viewMode, focusedDay, totalDays, daysInMonth]);

  // Map events and birthdays for date indicators
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

  const birthdayOccurrences = getBirthdaysForYear(birthdays, viewYear, today);
  const birthdayDateSet = new Set(birthdayOccurrences.map((b) => b.dateStr));

  // Determine which months in current year contain events or birthdays
  const monthsWithEvents = new Set<number>();
  events.forEach((e) => {
    const [sy, sm] = e.startDate.split("-").map(Number);
    const [ey, em] = e.endDate.split("-").map(Number);
    if (sy === viewYear) monthsWithEvents.add(sm - 1);
    if (ey === viewYear) monthsWithEvents.add(em - 1);
  });
  birthdayOccurrences.forEach((b) => {
    const [, m] = b.dateStr.split("-").map(Number);
    monthsWithEvents.add(m - 1);
  });

  function handleJumpToday() {
    const ds = toDateStr(today);
    if ((!min || ds >= min) && (!max || ds <= max)) {
      onChange(ds);
    }
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setOpen(false);
    setViewMode("days");
    triggerRef.current?.focus();
  }

  function handleClear() {
    onChange("");
    setOpen(false);
    setViewMode("days");
    triggerRef.current?.focus();
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
      {/* Trigger Button: while open border and icon turn red */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((o) => !o);
            setViewMode("days");
          }
        }}
        className={cn(
          "w-full flex items-center justify-between gap-2 bg-[#000000] border px-[10px] py-[9px] text-[13px] text-left transition outline-none cursor-pointer rounded-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000] focus-visible:-outline-offset-1",
          error
            ? "border-[#cc0000] text-[#e8e8e8]"
            : open
            ? "border-[#cc0000] text-white"
            : "border-[#2a2a2a] text-[#e8e8e8] hover:border-[#444]",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={cn("truncate", !value && "text-[#6b7280]")}>
          {displayLabel}
        </span>
        <CalendarIcon
          className={cn(
            "w-4 h-4 shrink-0 transition-colors",
            open ? "text-[#cc0000]" : "text-[#6b7280]"
          )}
        />
      </button>

      {/* Popover directly under field: width 260px, background #0a0a0a, 1px #2a2a2a border, 2px red top border, padding 10px */}
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
              width: 260,
              zIndex: 9999,
            }}
            className="border border-[#2a2a2a] border-t-2 border-t-[#cc0000] bg-[#0a0a0a] p-[10px] shadow-2xl select-none animate-in fade-in duration-150 rounded-none"
          >
            {/* ─── 1. DAYS VIEW ────────────────────────────────────────────── */}
            {viewMode === "days" && (
              <div>
                {/* Header: left arrow, clickable title "NOVEMBER 2026", right arrow */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (viewMonth === 0) {
                        setViewMonth(11);
                        setViewYear((y) => y - 1);
                      } else {
                        setViewMonth((m) => m - 1);
                      }
                    }}
                    className="p-1 text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("months")}
                    className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#e8e8e8] hover:text-white transition cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                  >
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (viewMonth === 11) {
                        setViewMonth(0);
                        setViewYear((y) => y + 1);
                      } else {
                        setViewMonth((m) => m + 1);
                      }
                    }}
                    className="p-1 text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Weekday row (Su Mo Tu We Th Fr Sa, 9px muted) */}
                <div className="grid grid-cols-7 mb-1 text-center">
                  {WEEKDAY_SHORT.map((wd) => (
                    <div
                      key={wd}
                      className="text-[9px] font-bold uppercase text-[#6b7280] py-0.5"
                    >
                      {wd}
                    </div>
                  ))}
                </div>

                {/* 7-column grid of day buttons, each 30px tall, 11px text */}
                <div className="grid grid-cols-7 gap-0.5">
                  {emptyLeadingCells.map((_, i) => (
                    <div key={`empty-${i}`} className="h-[30px] w-full" />
                  ))}

                  {daysInMonth.map((day, idx) => {
                    const ds = toDateStr(day);
                    const isSelected = value === ds;
                    const isToday = todayStr === ds;
                    const hasEvent = eventDateSet.has(ds);
                    const hasBirthday = birthdayDateSet.has(ds);
                    const hasItem = hasEvent || hasBirthday;
                    const colIdx = (firstDow + idx) % 7;
                    const isWeekend = colIdx === 0 || colIdx === 6;
                    const isKeyFocused = focusedDay === day.getDate();

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
                          "relative flex flex-col items-center justify-center h-[30px] w-full text-[11px] font-medium rounded-none transition cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]",
                          isDisabled && "opacity-25 cursor-not-allowed",
                          !isDisabled && isSelected && "bg-[#cc0000] text-white font-bold",
                          !isDisabled && !isSelected && isToday && "outline outline-1 outline-[#cc0000] text-white font-bold",
                          !isDisabled && !isSelected && !isToday && isWeekend && "text-[#6b7280] hover:bg-[#1a1a1a]",
                          !isDisabled && !isSelected && !isToday && !isWeekend && "text-[#e8e8e8] hover:bg-[#1a1a1a]",
                          !isDisabled && !isSelected && isKeyFocused && "bg-[#1a1a1a]"
                        )}
                      >
                        <span>{day.getDate()}</span>

                        {/* Days with events: a 3x3px yellow square near bottom (white when selected) */}
                        {hasItem && (
                          <span
                            className={cn(
                              "absolute bottom-0.5 w-[3px] h-[3px] rounded-none shrink-0",
                              isSelected ? "bg-white" : "bg-[#f5b301]"
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Footer with 1px #1f1f1f top border: "CLEAR" left (#9aa1ad) and "TODAY" right (red text) */}
                <div className="mt-2.5 pt-2 border-t border-[#1f1f1f] flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.07em]">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                  >
                    CLEAR
                  </button>
                  <button
                    type="button"
                    onClick={handleJumpToday}
                    className="text-[#cc0000] hover:underline transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                  >
                    TODAY
                  </button>
                </div>
              </div>
            )}

            {/* ─── 2. MONTH VIEW ──────────────────────────────────────────── */}
            {viewMode === "months" && (
              <div>
                {/* Header: left/right arrows to change year, clicking year switches to YEAR VIEW */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y - 1)}
                    className="p-1 text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                    aria-label="Previous year"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setYearGridBase(Math.floor(viewYear / 12) * 12);
                      setViewMode("years");
                    }}
                    className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#e8e8e8] hover:text-white transition cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                  >
                    {viewYear}
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y + 1)}
                    className="p-1 text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                    aria-label="Next year"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 3-column by 4-row grid of Jan to Dec (cells 36px tall, 11px text) */}
                <div className="grid grid-cols-3 gap-1.5 my-1">
                  {MONTH_NAMES_SHORT.map((name, idx) => {
                    const isSelected = idx === viewMonth;
                    const hasEvents = monthsWithEvents.has(idx);

                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setViewMonth(idx);
                          setViewMode("days");
                        }}
                        className={cn(
                          "relative h-[36px] flex items-center justify-center text-[11px] font-bold uppercase tracking-[0.07em] rounded-none transition cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]",
                          isSelected
                            ? "bg-[#cc0000] text-white"
                            : "text-[#9aa1ad] hover:text-white hover:bg-[#1a1a1a]"
                        )}
                      >
                        <span>{name}</span>
                        {/* Months containing events: small yellow dot */}
                        {hasEvents && !isSelected && (
                          <span className="absolute bottom-1 w-[3px] h-[3px] bg-[#f5b301] rounded-none" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Footer: "BACK TO DAYS" (left, muted) and "THIS MONTH" (right, red) */}
                <div className="mt-2.5 pt-2 border-t border-[#1f1f1f] flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.07em]">
                  <button
                    type="button"
                    onClick={() => setViewMode("days")}
                    className="text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                  >
                    BACK TO DAYS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMonth(today.getMonth());
                      setViewYear(today.getFullYear());
                      setViewMode("days");
                    }}
                    className="text-[#cc0000] hover:underline transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                  >
                    THIS MONTH
                  </button>
                </div>
              </div>
            )}

            {/* ─── 3. YEAR VIEW ───────────────────────────────────────────── */}
            {viewMode === "years" && (
              <div>
                {/* Header: range like "2020 - 2031" with arrows that move by 12 years */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => setYearGridBase((b) => b - 12)}
                    className="p-1 text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                    aria-label="Previous 12 years"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#e8e8e8]">
                    {yearGridBase} – {yearGridBase + 11}
                  </span>

                  <button
                    type="button"
                    onClick={() => setYearGridBase((b) => b + 12)}
                    className="p-1 text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                    aria-label="Next 12 years"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 3x4 grid of years */}
                <div className="grid grid-cols-3 gap-1.5 my-1">
                  {Array.from({ length: 12 }, (_, i) => yearGridBase + i).map((yr) => {
                    const isSelected = yr === viewYear;
                    const isFar = Math.abs(yr - today.getFullYear()) > 20;

                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setViewYear(yr);
                          setViewMode("months");
                        }}
                        className={cn(
                          "h-[36px] flex items-center justify-center text-[11px] font-bold tracking-[0.07em] rounded-none transition cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]",
                          isSelected
                            ? "bg-[#cc0000] text-white"
                            : isFar
                            ? "text-[#4b5563] hover:text-white hover:bg-[#1a1a1a]"
                            : "text-[#9aa1ad] hover:text-white hover:bg-[#1a1a1a]"
                        )}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>

                {/* Footer: "BACK TO MONTHS" (left, muted) and "THIS YEAR" (right, red) */}
                <div className="mt-2.5 pt-2 border-t border-[#1f1f1f] flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.07em]">
                  <button
                    type="button"
                    onClick={() => setViewMode("months")}
                    className="text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                  >
                    BACK TO MONTHS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewYear(today.getFullYear());
                      setYearGridBase(Math.floor(today.getFullYear() / 12) * 12);
                      setViewMode("months");
                    }}
                    className="text-[#cc0000] hover:underline transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]"
                  >
                    THIS YEAR
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
