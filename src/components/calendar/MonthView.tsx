"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  BirthdayOccurrence,
  getDaysInMonth,
  isSameDay,
  toDateStr,
} from "@/lib/calendar-storage";

interface MonthViewProps {
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

const WEEKDAY_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MAX_CHIPS = 2;

export function getTypeStyle(category: string) {
  switch (category) {
    case "Birthdays":
      return { hex: "#f5b301", bg: "#f5b30122" };
    case "Meeting":
      return { hex: "#5b9cf5", bg: "#5b9cf522" };
    case "Competition":
      return { hex: "#cc0000", bg: "#cc000022" };
    case "Workshop":
      return { hex: "#a78bfa", bg: "#a78bfa22" };
    case "Deadline":
      return { hex: "#fb923c", bg: "#fb923c22" };
    case "Team Activity":
      return { hex: "#34d399", bg: "#34d39922" };
    case "Other":
    default:
      return { hex: "#9ca3af", bg: "#9ca3af22" };
  }
}

export default function MonthView({
  viewDate,
  selectedDate,
  today,
  events,
  birthdays,
  onSelectDate,
  onEventClick,
  onBirthdayClick,
  onAddEventOnDate,
}: MonthViewProps) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getDaysInMonth(year, month);
  const firstDow = days[0].getDay();
  const totalCells = Math.ceil((firstDow + days.length) / 7) * 7;

  const isCurrentMonthView = today.getFullYear() === year && today.getMonth() === month;
  const currentWeekday = isCurrentMonthView ? today.getDay() : -1;

  function eventsOnDate(day: Date): CalendarEvent[] {
    const ds = toDateStr(day);
    return events.filter((e) => e.startDate <= ds && e.endDate >= ds);
  }

  function birthdaysOnDate(day: Date): BirthdayOccurrence[] {
    const ds = toDateStr(day);
    return birthdays.filter((b) => b.dateStr === ds);
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
    <div className="border border-[#1f1f1f] bg-[#000000] overflow-hidden select-none">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[#1f1f1f] bg-[#000000]">
        {WEEKDAY_HEADERS.map((h, colIdx) => {
          const isTodayHeader = currentWeekday === colIdx;
          return (
            <div
              key={h}
              className={cn(
                "py-2 text-center text-[10px] font-bold uppercase tracking-[0.07em] border-r border-[#1f1f1f] last:border-r-0 transition-colors",
                isTodayHeader
                  ? "border-b-2 border-b-[#cc0000] text-white"
                  : "text-[#6b7280]"
              )}
            >
              {h}
            </div>
          );
        })}
      </div>

      {/* Day grid: 150ms fade animation on month change */}
      <div key={`${year}-${month}`} className="grid grid-cols-7 animate-in fade-in duration-150">
        {cells.map((day, idx) => {
          const colIdx = idx % 7;
          const isWeekend = colIdx === 0 || colIdx === 6;

          if (!day) {
            return (
              <div
                key={`empty-${idx}`}
                className={cn(
                  "border-b border-r border-[#1f1f1f] min-h-[76px] p-[5px] bg-[#050505]",
                  colIdx === 6 && "border-r-0"
                )}
              />
            );
          }

          const ds = toDateStr(day);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const dayEvents = eventsOnDate(day);
          const dayBirthdays = birthdaysOnDate(day);

          // Combined items: birthdays first, then events
          const allItems: Array<
            | { type: "birthday"; data: BirthdayOccurrence }
            | { type: "event"; data: CalendarEvent }
          > = [
            ...dayBirthdays.map((b) => ({ type: "birthday" as const, data: b })),
            ...dayEvents.map((e) => ({ type: "event" as const, data: e })),
          ];

          const visibleItems = allItems.slice(0, MAX_CHIPS);
          const overflowCount = allItems.length - MAX_CHIPS;

          return (
            <div
              key={ds}
              onClick={() => onSelectDate(day)}
              className={cn(
                "group relative border-b border-r border-[#1f1f1f] min-h-[76px] p-[5px] cursor-pointer transition-colors",
                colIdx === 6 && "border-r-0",
                isWeekend && !isToday && !isSelected && "bg-[#050505]",
                !isWeekend && !isToday && !isSelected && "bg-[#000000]",
                isToday && "bg-[#1a0505]",
                isSelected && "outline outline-1 outline-[#cc0000] -outline-offset-1 z-10",
                "hover:bg-[#0d0d0d]"
              )}
            >
              {/* Day header: number + quick add "+" */}
              <div className="flex items-start justify-between leading-none">
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-[11px] font-bold bg-[#cc0000] text-white">
                    {day.getDate()}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-[11px] font-bold pl-0.5 pt-0.5",
                      isWeekend ? "text-[#6b7280]" : "text-[#e8e8e8]"
                    )}
                  >
                    {day.getDate()}
                  </span>
                )}

                {/* Hover "+" button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEventOnDate(day);
                  }}
                  className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-[#9aa1ad] hover:text-white hover:bg-[#1a1a1a] transition text-[13px] leading-none"
                  aria-label={`Add event on ${ds}`}
                  title="Add event for this date"
                >
                  +
                </button>
              </div>

              {/* Event & Birthday chips */}
              <div className="mt-1 space-y-[3px]">
                {visibleItems.map((item) => {
                  if (item.type === "birthday") {
                    const b = item.data;
                    const style = getTypeStyle("Birthdays");
                    return (
                      <button
                        key={`bday-${b.record.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBirthdayClick(b);
                        }}
                        className="w-full text-left block truncate mt-[3px] px-[5px] py-[1px] text-[9px] text-[#e8e8e8] border-l-2 hover:brightness-125 transition"
                        style={{
                          borderLeftColor: style.hex,
                          backgroundColor: style.bg,
                        }}
                        title={`Birthday: ${b.record.name} (${b.statusText})`}
                      >
                        <span className="truncate block font-normal">
                          {b.record.name}
                        </span>
                      </button>
                    );
                  }

                  const ev = item.data;
                  const style = getTypeStyle(ev.category);
                  return (
                    <button
                      key={`ev-${ev.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      className="w-full text-left block truncate mt-[3px] px-[5px] py-[1px] text-[9px] text-[#e8e8e8] border-l-2 hover:brightness-125 transition"
                      style={{
                        borderLeftColor: style.hex,
                        backgroundColor: style.bg,
                      }}
                      title={`${ev.category}: ${ev.title}`}
                    >
                      <span className="truncate block font-normal">
                        {ev.title}
                      </span>
                    </button>
                  );
                })}

                {/* Overflow label */}
                {overflowCount > 0 && (
                  <span className="block text-[9px] text-[#6b7280] ml-[5px] mt-[2px] font-semibold leading-none">
                    +{overflowCount} more
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
