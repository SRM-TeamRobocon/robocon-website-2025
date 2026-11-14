"use client";

import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarEvent, CATEGORY_DOT, toDateStr } from "@/lib/calendar-storage";

interface DayViewProps {
  viewDate: Date;
  today: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: () => void;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12;
  return `${String(h).padStart(2, "0")}:00 ${i < 12 ? "AM" : "PM"}`;
});

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export default function DayView({
  viewDate,
  today,
  events,
  onEventClick,
  onAddEvent,
}: DayViewProps) {
  const ds = toDateStr(viewDate);
  const dayEvents = events
    .filter((e) => e.startDate <= ds && e.endDate >= ds)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const isToday =
    viewDate.getFullYear() === today.getFullYear() &&
    viewDate.getMonth() === today.getMonth() &&
    viewDate.getDate() === today.getDate();

  const dateLabel = viewDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Current hour for today highlight
  const nowHour = isToday ? today.getHours() : -1;

  return (
    <div className="border border-white/10 overflow-hidden">
      {/* Day header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <span
            className={cn(
              "text-sm font-black uppercase tracking-widest",
              isToday ? "text-red" : "text-white"
            )}
          >
            {dateLabel}
          </span>
          {isToday && (
            <span className="ml-2 text-xs font-bold uppercase tracking-widest text-red">
              Today
            </span>
          )}
        </div>
        <button
          onClick={onAddEvent}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-white/10 text-xs font-bold uppercase tracking-widest text-gray-300 hover:text-white hover:border-white/30 transition"
        >
          <Plus className="w-3 h-3" />
          Add Event
        </button>
      </div>

      {/* All-day / no-time events */}
      {dayEvents.filter((e) => !e.startTime).length > 0 && (
        <div className="border-b border-white/10 px-4 py-2 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            All Day
          </p>
          {dayEvents
            .filter((e) => !e.startTime)
            .map((ev) => (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="w-full text-left"
              >
                <div
                  className="px-2 py-1 text-xs font-medium border-l-2 bg-white/5 hover:bg-white/10 transition"
                  style={{ borderLeftColor: getCategoryHex(ev.category) }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-1.5 h-1.5 shrink-0", CATEGORY_DOT[ev.category])} />
                    <span className="text-gray-200">{ev.title}</span>
                  </div>
                </div>
              </button>
            ))}
        </div>
      )}

      {/* Hour grid */}
      <div className="overflow-y-auto max-h-[480px]">
        {HOUR_LABELS.map((label, hour) => {
          const hourEvents = dayEvents.filter((e) => {
            if (!e.startTime) return false;
            return Math.floor(timeToMinutes(e.startTime) / 60) === hour;
          });
          const isCurrentHour = hour === nowHour;

          return (
            <div
              key={label}
              className={cn(
                "flex border-b border-white/5 last:border-b-0 min-h-[52px]",
                isCurrentHour && "bg-red/[0.04]"
              )}
            >
              {/* Hour label */}
              <div className="w-20 shrink-0 px-3 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 border-r border-white/10">
                {label}
                {isCurrentHour && (
                  <div className="mt-0.5 w-1.5 h-1.5 bg-red" />
                )}
              </div>

              {/* Events in this hour */}
              <div className="flex-1 p-1 space-y-1">
                {hourEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="w-full text-left"
                  >
                    <div
                      className="px-2 py-1.5 text-xs border-l-2 bg-white/5 hover:bg-white/10 transition"
                      style={{ borderLeftColor: getCategoryHex(ev.category) }}
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className={cn("w-1.5 h-1.5 shrink-0", CATEGORY_DOT[ev.category])} />
                        <span className="text-gray-200 font-semibold">{ev.title}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 pl-3">
                        {formatTime(ev.startTime)}
                        {ev.endTime && ` – ${formatTime(ev.endTime)}`}
                        {ev.location && ` · ${ev.location}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {dayEvents.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-600 text-sm">No events scheduled for this day.</p>
          <button
            onClick={onAddEvent}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/10 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add an Event
          </button>
        </div>
      )}
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
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}
