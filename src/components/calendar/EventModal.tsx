"use client";

import React, { useEffect, useRef } from "react";
import { X, Pencil, Trash2, MapPin, Clock, Tag, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  CATEGORY_COLORS,
  CATEGORY_DOT,
  formatDisplayDate,
} from "@/lib/calendar-storage";

interface EventModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
}

function formatTime(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function EventModal({ event, onClose, onEdit, onDelete }: EventModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleDelete() {
    if (window.confirm(`Delete "${event.title}"? This cannot be undone.`)) {
      onDelete(event.id);
    }
  }

  const isSingleDay = event.startDate === event.endDate;

  const dateDisplay = isSingleDay
    ? formatDisplayDate(event.startDate)
    : `${formatDisplayDate(event.startDate)} – ${formatDisplayDate(event.endDate)}`;

  const timeDisplay = event.startTime
    ? event.endTime
      ? `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`
      : formatTime(event.startTime)
    : "All day";

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg bg-black border border-white/10 shadow-2xl">
        {/* Coloured top bar */}
        <div
          className="h-1"
          style={{ backgroundColor: getCategoryHex(event.category) }}
        />

        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset mb-2",
                CATEGORY_COLORS[event.category]
              )}
            >
              <span className={cn("w-1.5 h-1.5", CATEGORY_DOT[event.category])} />
              {event.category}
            </span>
            <h2 className="text-xl font-black text-white break-words">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 text-gray-500 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {/* Date */}
          <div className="flex items-start gap-3 text-sm">
            <div className="mt-0.5 shrink-0 w-4 h-4 text-gray-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="0" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <span className="text-gray-200">{dateDisplay}</span>
          </div>

          {/* Time */}
          <div className="flex items-start gap-3 text-sm">
            <Clock className="mt-0.5 shrink-0 w-4 h-4 text-gray-500" />
            <span className="text-gray-200">{timeDisplay}</span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="mt-0.5 shrink-0 w-4 h-4 text-gray-500" />
              <span className="text-gray-200">{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3 text-sm">
              <FileText className="mt-0.5 shrink-0 w-4 h-4 text-gray-500" />
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest border border-red/40 text-red hover:bg-red/10 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <button
            onClick={() => onEdit(event)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-white/10 text-white hover:bg-white/20 transition"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
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
