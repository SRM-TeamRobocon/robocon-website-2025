"use client";

import React from "react";
import { Cake } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  BirthdayOccurrence,
  CATEGORY_DOT,
  getWeekDays,
  isSameDay,
  toDateStr,
} from "@/lib/calendar-storage";

interface WeekViewProps {
  viewDate: Date;
  selectedDate: Date;
  today: Date;
  events: CalendarEvent[];
  birthdays: BirthdayOccurrence[];
  onSelectDate: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onBirthdayClick: (occurrence: BirthdayOccurrence) => void;
  onAddEventOnDate: (date: Date) => void;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WeekView({
  viewDate,
  selectedDate,
  today,
  events,
  birthdays,
  onSelectDate,
  onEventClick,
  onBirthdayClick,
  onAddEventOnDate,
}: WeekViewProps) {
  const weekDays = getWeekDays(viewDate);

  function eventsOnDate(day: Date): CalendarEvent[] {
    const ds = toDateStr(day);
    return events.filter((e) => e.startDate <= ds && e.endDate >= ds);
  }

  function birthdaysOnDate(day: Date): BirthdayOccurrence[] {
    const ds = toDateStr(day);
    return birthdays.filter((b) => b.dateStr === ds);
  }

  return (
    <div className="border border-white/10 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button
              key={toDateStr(day)}
              onClick={() => onSelectDate(day)}
              className={cn(
                "py-3 flex flex-col items-center gap-0.5 border-r border-white/10 last:border-r-0 transition hover:bg-white/5",
                isSelected && "bg-white/[0.04]"
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {WEEKDAY_SHORT[day.getDay()]}
              </span>
              <span
                className={cn(
                  "w-7 h-7 flex items-center justify-center text-sm font-black",
                  isToday && "bg-red text-white",
                  !isToday && isSelected && "bg-white/15 text-white",
                  !isToday && !isSelected && "text-gray-300"
                )}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Event & Birthday rows per day */}
      <div className="grid grid-cols-7 min-h-[320px]">
        {weekDays.map((day) => {
          const ds = toDateStr(day);
          const dayEvents = eventsOnDate(day);
          const dayBirthdays = birthdaysOnDate(day);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={ds}
              className={cn(
                "border-r border-white/10 last:border-r-0 p-1.5 space-y-1 cursor-pointer transition",
                isToday && "bg-red/[0.03]",
                !isToday && "hover:bg-white/[0.02]"
              )}
              onClick={() => onSelectDate(day)}
            >
              {/* Birthdays first */}
              {dayBirthdays.map((b) => (
                <button
                  key={`bday-${b.record.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBirthdayClick(b);
                  }}
                  className="w-full text-left"
                >
                  <div className="px-1.5 py-1 text-[11px] font-bold border-l-2 border-amber-400 bg-amber-500/15 hover:bg-amber-500/25 transition">
                    <div className="flex items-center gap-1 text-amber-200 truncate">
                      <Cake className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{b.record.name}</span>
                    </div>
                    <div className="text-[10px] text-amber-400/80 mt-0.5 pl-4">
                      {b.statusText}
                    </div>
                  </div>
                </button>
              ))}

              {/* Events */}
              {dayEvents.map((ev) => (
                <button
                  key={ev.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(ev);
                  }}
                  className="w-full text-left"
                >
                  <div
                    className="px-1.5 py-1 text-[11px] font-medium border-l-2 bg-white/5 hover:bg-white/10 transition"
                    style={{ borderLeftColor: getCategoryHex(ev.category) }}
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span className={cn("w-1.5 h-1.5 shrink-0", CATEGORY_DOT[ev.category])} />
                      <span className="truncate text-gray-200">{ev.title}</span>
                    </div>
                    {ev.startTime && (
                      <div className="text-[10px] text-gray-500 mt-0.5 pl-2.5">
                        {formatTime(ev.startTime)}
                      </div>
                    )}
                  </div>
                </button>
              ))}

              {dayEvents.length === 0 && dayBirthdays.length === 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEventOnDate(day);
                  }}
                  className="w-full text-center py-2 text-gray-700 hover:text-gray-500 text-xs transition"
                  title="Add Event"
                >
                  +
                </button>
              )}
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

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}
