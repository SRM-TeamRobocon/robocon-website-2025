"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  getDaysInMonth,
  isSameDay,
  toDateStr,
} from "@/lib/calendar-storage";

interface MiniCalendarProps {
  viewDate: Date;
  selectedDate: Date;
  today: Date;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function MiniCalendar({
  viewDate,
  selectedDate,
  today,
  events,
  onSelectDate,
  onPrev,
  onNext,
}: MiniCalendarProps) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getDaysInMonth(year, month);

  // leading empty cells so the grid starts on the correct weekday
  const firstDow = days[0].getDay();
  const emptyCells = Array.from({ length: firstDow });

  // Build a set of date strings that have events for quick lookup
  const eventDates = new Set(events.flatMap((e) => {
    const dates: string[] = [];
    const start = new Date(e.startDate + "T00:00:00");
    const end   = new Date(e.endDate   + "T00:00:00");
    const cur   = new Date(start);
    while (cur <= end) {
      dates.push(toDateStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }));

  const monthName = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="border border-white/10 bg-black p-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onPrev}
          className="p-1 text-gray-400 hover:text-white transition"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-white">
          {monthName}
        </span>
        <button
          onClick={onNext}
          className="p-1 text-gray-400 hover:text-white transition"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 py-0.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {emptyCells.map((_, i) => (
          <div key={`e${i}`} />
        ))}

        {days.map((day) => {
          const ds = toDateStr(day);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const hasEvent = eventDates.has(ds);

          return (
            <button
              key={ds}
              onClick={() => onSelectDate(day)}
              className={cn(
                "relative flex flex-col items-center justify-center h-7 w-full text-xs font-medium transition",
                isSelected && !isToday && "bg-white/15 text-white",
                isToday && "bg-red text-white font-black",
                !isSelected && !isToday && "text-gray-300 hover:bg-white/10"
              )}
            >
              {day.getDate()}
              {hasEvent && !isToday && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-red" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
