"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  EVENT_CATEGORIES,
  EventCategory,
  NewCalendarEvent,
  BirthdayRecord,
  toDateStr,
} from "@/lib/calendar-storage";
import CustomDatePicker from "./CustomDatePicker";
import TimePicker from "./TimePicker";

interface EventFormModalProps {
  initialEvent?: CalendarEvent;
  prefillDate?: string;
  events?: CalendarEvent[];
  birthdays?: BirthdayRecord[];
  onClose: () => void;
  onSave: (data: NewCalendarEvent) => void;
}

interface FormState {
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  category: EventCategory;
  location: string;
}

const CATEGORY_COLORS: Record<EventCategory, string> = {
  Meeting: "#5b9cf5",
  Competition: "#cc0000",
  Workshop: "#a78bfa",
  Deadline: "#fb923c",
  "Team Activity": "#34d399",
  Other: "#9ca3af",
};

const REMINDER_OPTIONS = ["None", "1 day before", "1 week before"] as const;

function to12Hour(time24: string): string {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return "";
  const m = mStr ? mStr.padStart(2, "0") : "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

function to24Hour(time12: string): string {
  if (!time12.trim()) return "";
  const match = time12.trim().match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i);
  if (!match) return time12;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function initialState(event?: CalendarEvent, prefillDate?: string): FormState {
  if (event) {
    return {
      title: event.title,
      description: event.description || "",
      startDate: event.startDate,
      startTime: event.startTime || "",
      endDate: event.endDate || event.startDate,
      endTime: event.endTime || "",
      category: event.category,
      location: event.location || "",
    };
  }
  const today = prefillDate ?? toDateStr(new Date());
  return {
    title: "",
    description: "",
    startDate: today,
    startTime: "",
    endDate: today,
    endTime: "",
    category: "Meeting",
    location: "",
  };
}

function validate(form: FormState, allDay: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.startDate) errors.startDate = "Start date is required.";
  if (!form.endDate) errors.endDate = "End date is required.";
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = "End date cannot be before start date.";
  }
  if (!allDay && form.startDate === form.endDate && form.startTime && form.endTime) {
    if (form.endTime < form.startTime) {
      errors.endTime = "End time must be after start time";
    }
  }
  return errors;
}

function getEventSummaryText(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  allDay: boolean
): string {
  if (!startDate) return "";
  const [y, m, d] = startDate.split("-").map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return "";
  const dateObj = new Date(y, m - 1, d);
  const dayStr = dateObj.toLocaleDateString("en-US", { weekday: "short" }) + " " + d;

  if (allDay || !startTime) {
    if (endDate && endDate !== startDate) {
      const [ey, em, ed] = endDate.split("-").map(Number);
      const eObj = new Date(ey, em - 1, ed);
      return `${dayStr} to ${eObj.toLocaleDateString("en-US", { weekday: "short" })} ${ed} - All day`;
    }
    return `${dayStr} - All day`;
  }

  if (startTime && endTime && startDate === endDate) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const diffMinutes = eh * 60 + em - (sh * 60 + sm);
    if (diffMinutes > 0) {
      const hrs = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      let durationStr = "";
      if (hrs > 0) durationStr += `${hrs} ${hrs === 1 ? "hour" : "hours"}`;
      if (mins > 0) durationStr += `${durationStr ? " " : ""}${mins} mins`;
      return `${dayStr} - ${durationStr}`;
    }
  }

  return `${dayStr} - ${to12Hour(startTime)}`;
}

export default function EventFormModal({
  initialEvent,
  prefillDate,
  events = [],
  birthdays = [],
  onClose,
  onSave,
}: EventFormModalProps) {
  const [form, setForm] = useState<FormState>(initialState(initialEvent, prefillDate));
  const [allDay, setAllDay] = useState(!initialEvent?.startTime && !initialEvent?.endTime);
  const [reminder, setReminder] = useState<string>("None");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const isEditing = !!initialEvent;

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "startDate" && next.endDate < value) {
        next.endDate = value as string;
      }
      // When start time is set and end time is empty, auto-set end time to start + 1 hour
      if (key === "startTime" && value && !prev.endTime) {
        const [h, m] = (value as string).split(":").map(Number);
        if (!isNaN(h)) {
          const nextH = (h + 1) % 24;
          next.endTime = `${String(nextH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
        }
      }
      return next;
    });
    if (submitted) {
      setErrors(validate({ ...form, [key]: value }, allDay));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(form, allDay);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      startDate: form.startDate,
      startTime: allDay ? "" : form.startTime,
      endDate: form.endDate || form.startDate,
      endTime: allDay ? "" : form.endTime,
      category: form.category,
      location: form.location.trim(),
    });
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  const summaryText = getEventSummaryText(
    form.startDate,
    form.startTime,
    form.endDate,
    form.endTime,
    allDay
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.82)" }}
    >
      {/* Modal Container: max-width 460px, background #050505, 1px #2a2a2a border, 2px red top border, no rounded corners */}
      <div className="relative w-full max-w-[460px] bg-[#050505] border border-[#2a2a2a] border-t-2 border-t-[#cc0000] shadow-2xl my-4 rounded-none">
        {/* Header row: title "ADD EVENT", X button, 1px #1f1f1f bottom border */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
          <h2 className="text-[13px] font-bold text-[#e8e8e8] uppercase tracking-[0.1em]">
            {isEditing ? "EDIT EVENT" : "ADD EVENT"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#9aa1ad] hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Body: padding 16px, 14px gaps */}
          <div className="p-4 space-y-[14px]">
            {/* a) Title */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                TITLE <span className="text-[#cc0000]">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Event title"
                className={cn(
                  "w-full bg-[#000000] border px-[10px] py-[9px] text-[13px] text-[#e8e8e8] placeholder-[#6b7280] outline-none rounded-none transition",
                  errors.title ? "border-[#cc0000]" : "border-[#2a2a2a] focus:border-[#555]"
                )}
              />
              {errors.title && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-[#cc0000]">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {errors.title}
                </p>
              )}
            </div>

            {/* b) Type: 3-column by 2-row grid of selectable chips (gap 8px, 2 columns on < 520px) */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                TYPE
              </label>
              <div className="grid grid-cols-2 min-[520px]:grid-cols-3 gap-2">
                {EVENT_CATEGORIES.map((cat) => {
                  const isSelected = form.category === cat;
                  const color = CATEGORY_COLORS[cat];
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => set("category", cat)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-2 text-[10px] font-bold uppercase tracking-[0.07em] border transition cursor-pointer rounded-none text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#cc0000]",
                        isSelected
                          ? "border-[#cc0000] bg-[#1a0505] text-white"
                          : "border-[#2a2a2a] bg-[#000000] text-[#9aa1ad] hover:border-[#444]"
                      )}
                    >
                      <span
                        className="w-2 h-2 shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* c) Date and End date (optional) side by side (stacks on < 520px) */}
            <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                  DATE <span className="text-[#cc0000]">*</span>
                </label>
                <CustomDatePicker
                  value={form.startDate}
                  onChange={(ds) => set("startDate", ds)}
                  placeholder="Start date"
                  events={events}
                  birthdays={birthdays}
                  error={!!errors.startDate}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                  END DATE
                </label>
                <CustomDatePicker
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(ds) => set("endDate", ds)}
                  placeholder="Same day"
                  events={events}
                  birthdays={birthdays}
                  error={!!errors.endDate}
                />
              </div>
            </div>

            {/* d) Start time and End time side by side (stacks on < 520px) */}
            {!allDay && (
              <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                    START TIME
                  </label>
                  <TimePicker
                    value={form.startTime}
                    onChange={(t) => set("startTime", t)}
                    placeholder="09:00 AM"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                    END TIME
                  </label>
                  <TimePicker
                    value={form.endTime}
                    onChange={(t) => set("endTime", t)}
                    placeholder="10:00 AM"
                    error={!!errors.endTime}
                  />
                  {errors.endTime && (
                    <p className="mt-1 text-[11px] text-[#cc0000]">
                      {errors.endTime}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* e) "All day" toggle (30x16px, square thumb, red when on) */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280]">
                ALL DAY EVENT
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={allDay}
                onClick={() => setAllDay(!allDay)}
                className={cn(
                  "relative w-[30px] h-[16px] transition-colors p-[2px] rounded-none border border-[#2a2a2a] shrink-0",
                  allDay ? "bg-[#cc0000]" : "bg-[#111111]"
                )}
                aria-label="Toggle All day event"
              >
                <span
                  className={cn(
                    "block w-[10px] h-[10px] transition-transform rounded-none",
                    allDay ? "translate-x-[14px] bg-white" : "translate-x-0 bg-[#6b7280]"
                  )}
                />
              </button>
            </div>

            {/* f) Location */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                LOCATION
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="e.g. Lab 3, Online"
                className="w-full bg-[#000000] border border-[#2a2a2a] px-[10px] py-[9px] text-[13px] text-[#e8e8e8] placeholder-[#6b7280] outline-none focus:border-[#555] rounded-none transition"
              />
            </div>

            {/* g) Reminder chip row */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                REMINDER
              </label>
              <div className="flex items-center gap-2">
                {REMINDER_OPTIONS.map((opt) => {
                  const isSelected = reminder === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setReminder(opt)}
                      className={cn(
                        "flex-1 py-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.07em] border transition cursor-pointer rounded-none text-center",
                        isSelected
                          ? "border-[#cc0000] bg-[#1a0505] text-white"
                          : "border-[#2a2a2a] bg-[#000000] text-[#9aa1ad] hover:border-[#444]"
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* h) Notes: textarea, about 52px tall */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                NOTES
              </label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Add notes..."
                className="w-full h-[52px] bg-[#000000] border border-[#2a2a2a] px-[10px] py-[8px] text-[13px] text-[#e8e8e8] placeholder-[#6b7280] outline-none focus:border-[#555] rounded-none resize-none transition"
              />
            </div>
          </div>

          {/* Footer: 1px #1f1f1f top border, left summary, right CANCEL and SAVE EVENT (only red button) */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1f1f1f] bg-[#050505]">
            <span className="text-[11px] text-[#6b7280] truncate mr-2">
              {summaryText}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.07em] border border-[#2a2a2a] text-[#9aa1ad] hover:text-white hover:border-[#444] transition rounded-none"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.07em] bg-[#cc0000] text-white hover:bg-[#aa0000] transition rounded-none cursor-pointer"
              >
                SAVE EVENT
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
