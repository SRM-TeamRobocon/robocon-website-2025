"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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

/** ISO-8601 week number for a given date */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Format "HH:mm" (24-hr) → "H:MM AM/PM" */
function fmt12(t: string): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

// ─── Cake SVG icon (inline, no font dependency) ───────────────────────────────
const CakeIcon = () => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width="11"
    height="11"
    fill="none"
    stroke="#f5b301"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "inline-block", flexShrink: 0 }}
  >
    {/* candle */}
    <line x1="8" y1="1" x2="8" y2="4" />
    {/* flame */}
    <circle cx="8" cy="1" r="0.8" fill="#f5b301" stroke="none" />
    {/* cake body */}
    <rect x="2" y="6" width="12" height="4" rx="0" />
    <rect x="2" y="10" width="12" height="4" rx="0" />
    {/* frosting waves */}
    <path d="M2 10 Q4 8.5 6 10 Q8 11.5 10 10 Q12 8.5 14 10" strokeWidth="1" />
  </svg>
);

// ─── Chip Tooltip ─────────────────────────────────────────────────────────────
interface TooltipState {
  id: string;
  title: string;
  typeColor: string;
  typeLine: string; // free-form string: category, or "Category · HH:MM AM to HH:MM AM"
  location?: string;
  anchorEl: HTMLElement;
}

function ChipTooltip({ tip }: { tip: TooltipState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean }>({
    top: 0,
    left: 0,
    above: false,
  });

  useEffect(() => {
    if (!ref.current) return;
    const anchor = tip.anchorEl.getBoundingClientRect();
    const card = ref.current;
    const cardH = card.offsetHeight || 90;
    const cardW = card.offsetWidth || 210;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - anchor.bottom - 6;
    const above = spaceBelow < cardH && anchor.top > cardH + 6;

    let top = above
      ? anchor.top - cardH - 4 + window.scrollY
      : anchor.bottom + 4 + window.scrollY;

    let left = anchor.left + window.scrollX;
    if (left + cardW > vw - 8) left = vw - cardW - 8 + window.scrollX;
    if (left < 8) left = 8 + window.scrollX;

    setPos({ top, left, above });
  }, [tip]);

  return (
    <div
      ref={ref}
      role="tooltip"
      id={tip.id}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: 210,
        background: "#0a0a0a",
        border: "1px solid #2a2a2a",
        borderTop: `2px solid ${tip.typeColor}`,
        outline: "1px solid #000",
        padding: "9px 10px",
        zIndex: 9999,
        opacity: 1,
        animation: "mv-tooltip-in 120ms ease",
        pointerEvents: "none",
      }}
    >
      <style>{`@keyframes mv-tooltip-in{from{opacity:0}to{opacity:1}}`}</style>
      <div style={{ fontSize: 12, color: "#e8e8e8", lineHeight: 1.4, marginBottom: 4, wordBreak: "break-word" }}>
        {tip.title}
      </div>
      {tip.typeLine && (
        <div style={{ fontSize: 10, color: "#9aa1ad", lineHeight: 1.4 }}>{tip.typeLine}</div>
      )}
      {tip.location && (
        <div style={{ fontSize: 10, color: "#9aa1ad", lineHeight: 1.4, marginTop: 2 }}>
          📍 {tip.location}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
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
  const numRows = totalCells / 7;

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

  // ── Tooltip state ──────────────────────────────────────────────────────────
  const [activeTip, setActiveTip] = useState<TooltipState | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTipId = useRef<string | null>(null);

  const clearTip = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setActiveTip(null);
    activeTipId.current = null;
  }, []);

  // Dismiss on scroll or Esc
  useEffect(() => {
    const onScroll = () => clearTip();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") clearTip(); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [clearTip]);

  function buildEventTip(ev: CalendarEvent, el: HTMLElement): TooltipState {
    const style = getTypeStyle(ev.category);
    let typeLine: string = ev.category;
    if (ev.startTime) {
      typeLine = ev.endTime
        ? `${ev.category} · ${fmt12(ev.startTime)} to ${fmt12(ev.endTime)}`
        : `${ev.category} · ${fmt12(ev.startTime)}`;
    }
    return {
      id: `tip-ev-${ev.id}`,
      title: ev.title,
      typeColor: style.hex,
      typeLine,
      location: ev.location || undefined,
      anchorEl: el,
    };
  }

  function buildBdayTip(b: BirthdayOccurrence, el: HTMLElement): TooltipState {
    return {
      id: `tip-bd-${b.record.id}`,
      title: b.record.name,
      typeColor: "#f5b301",
      typeLine: `Birthday · ${b.statusText}`,
      anchorEl: el,
    };
  }

  function onChipMouseEnter(id: string, buildTip: (el: HTMLElement) => TooltipState, el: HTMLElement) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      activeTipId.current = id;
      setActiveTip(buildTip(el));
    }, 300);
  }

  function onChipFocus(id: string, buildTip: (el: HTMLElement) => TooltipState, el: HTMLElement) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    activeTipId.current = id;
    setActiveTip(buildTip(el));
  }

  function onChipLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setActiveTip(null);
    activeTipId.current = null;
  }

  // ── Compute ISO week number for the Monday in each row ────────────────────
  // Row r starts at cells[r*7]; Monday is cells[r*7 + 1] (col index 1 = MON)
  const rowWeeks: number[] = [];
  for (let r = 0; r < numRows; r++) {
    const mondayCell = cells[r * 7 + 1]; // column 1 = MON
    const refCell = mondayCell ?? cells[r * 7] ?? cells[r * 7 + 2];
    rowWeeks.push(refCell ? getISOWeek(refCell) : 0);
  }

  return (
    <div className="border border-[#1f1f1f] bg-[#000000] overflow-hidden select-none">
      {/* Weekday headers — 8 columns: week label col + 7 day cols */}
      <div className="hidden sm:grid border-b border-[#1f1f1f] bg-[#000000]"
        style={{ gridTemplateColumns: "30px repeat(7, 1fr)" }}>
        {/* empty cell above the week-label column */}
        <div className="border-r border-[#1f1f1f]" />
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

      {/* Mobile header (no week column) */}
      <div className="grid sm:hidden grid-cols-7 border-b border-[#1f1f1f] bg-[#000000]">
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

      {/* Day grid: each row = week-label cell + 7 day cells */}
      <div key={`${year}-${month}`} className="animate-in fade-in duration-150">
        {Array.from({ length: numRows }, (_, r) => {
          const rowCells = cells.slice(r * 7, r * 7 + 7);
          const weekNum = rowWeeks[r];

          return (
            <div key={r} className="hidden sm:grid" style={{ gridTemplateColumns: "30px repeat(7, 1fr)" }}>
              {/* Week label cell */}
              <div
                aria-hidden="true"
                className="border-b border-r border-[#1f1f1f] flex items-center justify-center min-h-[76px]"
                style={{ background: "#050505" }}
              >
                <span
                  style={{
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#4b5563",
                    userSelect: "none",
                  }}
                >
                  {weekNum > 0 ? `WEEK ${weekNum}` : ""}
                </span>
              </div>

              {/* 7 day cells */}
              {rowCells.map((day, colIdx) => {
                const isWeekend = colIdx === 0 || colIdx === 6;

                if (!day) {
                  return (
                    <div
                      key={`empty-${r}-${colIdx}`}
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

                const allItems: Array<
                  | { type: "birthday"; data: BirthdayOccurrence }
                  | { type: "event"; data: CalendarEvent }
                > = [
                  ...dayBirthdays.map((b) => ({ type: "birthday" as const, data: b })),
                  ...dayEvents.map((e) => ({ type: "event" as const, data: e })),
                ];

                const visibleItems = allItems.slice(0, MAX_CHIPS);
                const overflowCount = allItems.length - MAX_CHIPS;
                const totalCount = allItems.length;

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
                    {/* Day header: number + count badge + quick-add "+" */}
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

                      <div className="flex items-center gap-[3px]">
                        {/* Count badge — only when "+N more" is shown */}
                        {overflowCount > 0 && (
                          <span
                            aria-label={`${totalCount} events`}
                            title={`${totalCount} events`}
                            style={{
                              fontSize: 9,
                              color: "#9aa1ad",
                              border: "1px solid #2a2a2a",
                              background: "#000",
                              padding: "0 4px",
                              lineHeight: "14px",
                              display: "inline-block",
                            }}
                          >
                            {totalCount}
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
                    </div>

                    {/* Event & Birthday chips */}
                    <div className="mt-1 space-y-[3px]">
                      {visibleItems.map((item) => {
                        if (item.type === "birthday") {
                          const b = item.data;
                          const style = getTypeStyle("Birthdays");
                          const tipId = `tip-bd-${b.record.id}`;
                          const isActive = activeTip?.id === tipId;
                          return (
                            <button
                              key={`bday-${b.record.id}`}
                              type="button"
                              tabIndex={0}
                              aria-describedby={isActive ? tipId : undefined}
                              onClick={(e) => {
                                e.stopPropagation();
                                onBirthdayClick(b);
                              }}
                              onMouseEnter={(e) =>
                                onChipMouseEnter(tipId, (el) => buildBdayTip(b, el), e.currentTarget)
                              }
                              onMouseLeave={onChipLeave}
                              onFocus={(e) =>
                                onChipFocus(tipId, (el) => buildBdayTip(b, el), e.currentTarget)
                              }
                              onBlur={onChipLeave}
                              className="w-full text-left flex items-center gap-[3px] truncate mt-[3px] px-[5px] py-[1px] text-[9px] text-[#e8e8e8] border-l-2 hover:brightness-125 transition"
                              style={{
                                borderLeftColor: style.hex,
                                backgroundColor: style.bg,
                              }}
                              title={`Birthday: ${b.record.name} (${b.statusText})`}
                            >
                              <CakeIcon />
                              <span className="truncate block font-normal">{b.record.name}</span>
                            </button>
                          );
                        }

                        const ev = item.data;
                        const style = getTypeStyle(ev.category);
                        const tipId = `tip-ev-${ev.id}`;
                        const isActive = activeTip?.id === tipId;
                        return (
                          <button
                            key={`ev-${ev.id}`}
                            type="button"
                            tabIndex={0}
                            aria-describedby={isActive ? tipId : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(ev);
                            }}
                            onMouseEnter={(e) =>
                              onChipMouseEnter(tipId, (el) => buildEventTip(ev, el), e.currentTarget)
                            }
                            onMouseLeave={onChipLeave}
                            onFocus={(e) =>
                              onChipFocus(tipId, (el) => buildEventTip(ev, el), e.currentTarget)
                            }
                            onBlur={onChipLeave}
                            className="w-full text-left block truncate mt-[3px] px-[5px] py-[1px] text-[9px] text-[#e8e8e8] border-l-2 hover:brightness-125 transition"
                            style={{
                              borderLeftColor: style.hex,
                              backgroundColor: style.bg,
                            }}
                            title={`${ev.category}: ${ev.title}`}
                          >
                            <span className="truncate block font-normal">{ev.title}</span>
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
          );
        })}

        {/* Mobile grid — no week labels, flat 7-col layout */}
        <div className="sm:hidden grid grid-cols-7">
          {cells.map((day, idx) => {
            const colIdx = idx % 7;
            const isWeekend = colIdx === 0 || colIdx === 6;

            if (!day) {
              return (
                <div
                  key={`m-empty-${idx}`}
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

            const allItems: Array<
              | { type: "birthday"; data: BirthdayOccurrence }
              | { type: "event"; data: CalendarEvent }
            > = [
              ...dayBirthdays.map((b) => ({ type: "birthday" as const, data: b })),
              ...dayEvents.map((e) => ({ type: "event" as const, data: e })),
            ];

            const visibleItems = allItems.slice(0, MAX_CHIPS);
            const overflowCount = allItems.length - MAX_CHIPS;
            const totalCount = allItems.length;

            return (
              <div
                key={ds + "-m"}
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
                  <div className="flex items-center gap-[3px]">
                    {overflowCount > 0 && (
                      <span
                        aria-label={`${totalCount} events`}
                        title={`${totalCount} events`}
                        style={{
                          fontSize: 9,
                          color: "#9aa1ad",
                          border: "1px solid #2a2a2a",
                          background: "#000",
                          padding: "0 4px",
                          lineHeight: "14px",
                          display: "inline-block",
                        }}
                      >
                        {totalCount}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onAddEventOnDate(day); }}
                      className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-[#9aa1ad] hover:text-white hover:bg-[#1a1a1a] transition text-[13px] leading-none"
                      aria-label={`Add event on ${ds}`}
                      title="Add event for this date"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mt-1 space-y-[3px]">
                  {visibleItems.map((item) => {
                    if (item.type === "birthday") {
                      const b = item.data;
                      const style = getTypeStyle("Birthdays");
                      return (
                        <button
                          key={`bday-${b.record.id}-m`}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onBirthdayClick(b); }}
                          className="w-full text-left flex items-center gap-[3px] truncate mt-[3px] px-[5px] py-[1px] text-[9px] text-[#e8e8e8] border-l-2 hover:brightness-125 transition"
                          style={{ borderLeftColor: style.hex, backgroundColor: style.bg }}
                          title={`Birthday: ${b.record.name} (${b.statusText})`}
                        >
                          <CakeIcon />
                          <span className="truncate block font-normal">{b.record.name}</span>
                        </button>
                      );
                    }
                    const ev = item.data;
                    const style = getTypeStyle(ev.category);
                    return (
                      <button
                        key={`ev-${ev.id}-m`}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                        className="w-full text-left block truncate mt-[3px] px-[5px] py-[1px] text-[9px] text-[#e8e8e8] border-l-2 hover:brightness-125 transition"
                        style={{ borderLeftColor: style.hex, backgroundColor: style.bg }}
                        title={`${ev.category}: ${ev.title}`}
                      >
                        <span className="truncate block font-normal">{ev.title}</span>
                      </button>
                    );
                  })}
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

      {/* Tooltip portal — rendered outside the grid so z-index is unrestricted */}
      {/* Only shown on hover-capable devices via CSS */}
      {activeTip && (
        <style>{`@media (hover: none) { [data-mv-tooltip] { display: none !important; } }`}</style>
      )}
      {activeTip && (
        <div data-mv-tooltip="">
          <ChipTooltip tip={activeTip} />
        </div>
      )}
    </div>
  );
}
