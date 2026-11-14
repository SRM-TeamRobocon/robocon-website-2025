"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  CATEGORY_DOT,
  getDaysInMonth,
  isSameDay,
  toDateStr,
} from "@/lib/calendar-storage";

interface MonthViewProps {
  viewDate: Date;
  selectedDate: Date;
  today: Date;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEventOnDate: (date: Date) => void;
}

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 3;

export default function MonthView({
  viewDate,
  selectedDate,
  today,
  events,
  onSelectDate,
  onEventClick,
  onAddEventOnDate,
}: MonthViewProps) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getDaysInMonth(year, month);
  const firstDow = days[0].getDay();
  const totalCells = Math.ceil((firstDow + days.length) / 7) * 7;

  // Build a map: dateStr → events that fall on that date
  function eventsOnDate(day: Date): CalendarEvent[] {
    const ds = toDateStr(day);
    return events.filter((e) => e.startDate <= ds && e.endDate >= ds);
  }

  const cells: (Date | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayIdx = i - firstDow;
    if (dayIdx < 0 || dayIdx >= days.length) {
      cells.push(null);
    } else {
      cells.push(days[dayIdx]);
    }
  }

  return (
    <div className="border border-white/10 overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {WEEKDAY_HEADERS.map((h) => (
          <div
            key={h}
            className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 border-r border-white/10 last:border-r-0"
          >
            {h}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) {
            return (
              <div
                key={`empty-${idx}`}
                className="border-b border-r border-white/10 last:border-r-0 min-h-[90px] bg-white/[0.01]"
              />
            );
          }

          const ds = toDateStr(day);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const dayEvents = eventsOnDate(day);
          const isOtherMonth = day.getMonth() !== month;
          const colIdx = idx % 7;

          return (
            <div
              key={ds}
              onClick={() => onSelectDate(day)}
              className={cn(
                "relative border-b border-r border-white/10 last:border-r-0 min-h-[90px] p-1 cursor-pointer transition-colors",
                colIdx === 6 && "border-r-0",
                isSelected && !isToday && "bg-white/[0.04]",
                isOtherMonth && "opacity-40",
                !isSelected && !isToday && "hover:bg-white/[0.03]"
              )}
            >
              {/* Date number */}
              <div className="flex items-start justify-between mb-1">
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-6 h-6 text-xs font-bold",
                    isToday && "bg-red text-white",
                    !isToday && isSelected && "bg-white/15 text-white",
                    !isToday && !isSelected && "text-gray-300"
                  )}
                >
                  {day.getDate()}
                </span>

                {/* Quick add button — visible on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEventOnDate(day);
                  }}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition text-base leading-none"
                  aria-label="Add event"
                >
                  +
                </button>
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_VISIBLE).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    className="w-full text-left"
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1 px-1 py-0.5 text-[10px] font-medium truncate border-l-2 leading-tight",
                        "bg-white/5 hover:bg-white/10 transition",
                        `border-${CATEGORY_DOT[ev.category].replace("bg-", "")}`
                      )}
                      style={{
                        borderLeftColor: getCategoryHex(ev.category),
                      }}
                    >
                      <span
                        className={cn("w-1.5 h-1.5 shrink-0", CATEGORY_DOT[ev.category])}
                      />
                      <span className="truncate text-gray-200">{ev.title}</span>
                    </span>
                  </button>
                ))}
                {dayEvents.length > MAX_VISIBLE && (
                  <span className="block text-[10px] text-gray-500 px-1">
                    +{dayEvents.length - MAX_VISIBLE} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getCategoryHex(cat: string): string {
  const map: Record<string, string> = {
    Meeting: "#60a5fa",
    Competition: "#C20000",
    Workshop: "#a78bfa",
    Deadline: "#fbbf24",
    "Team Activity": "#34d399",
    Other: "#9ca3af",
  };
  return map[cat] ?? "#9ca3af";
}
