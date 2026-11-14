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

interface EventFormModalProps {
  /** If provided, we're editing an existing event. */
  initialEvent?: CalendarEvent;
  /** Pre-fill start date when opening from a date click. */
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

function initialState(event?: CalendarEvent, prefillDate?: string): FormState {
  if (event) {
    return {
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      startTime: event.startTime,
      endDate: event.endDate,
      endTime: event.endTime,
      category: event.category,
      location: event.location,
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

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.startDate) errors.startDate = "Start date is required.";
  if (!form.endDate) errors.endDate = "End date is required.";
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = "End date cannot be before start date.";
  }
  if (
    form.startDate === form.endDate &&
    form.startTime &&
    form.endTime &&
    form.endTime < form.startTime
  ) {
    errors.endTime = "End time cannot be before start time on the same day.";
  }
  return errors;
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const isEditing = !!initialEvent;

  // Auto-focus title
  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  // Escape to close
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
      // Auto-advance endDate if it falls behind startDate
      if (key === "startDate" && next.endDate < value) {
        next.endDate = value as string;
      }
      return next;
    });
    if (submitted) {
      setErrors(validate({ ...form, [key]: value }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      startDate: form.startDate,
      startTime: form.startTime,
      endDate: form.endDate,
      endTime: form.endTime,
      category: form.category,
      location: form.location.trim(),
    });
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-black border border-white/10 shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-black text-white uppercase tracking-widest">
            {isEditing ? "Edit Event" : "New Event"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5 space-y-4">
            {/* Title */}
            <Field label="Title" error={errors.title} required>
              <input
                ref={titleRef}
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Event title"
                className={cn(
                  "w-full bg-white/5 border px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/40 transition",
                  errors.title ? "border-red" : "border-white/10"
                )}
              />
            </Field>

            {/* Category */}
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value as EventCategory)}
                className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/40 transition appearance-none cursor-pointer"
              >
                {EVENT_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-black">
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            {/* Custom Date Picker for Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date" error={errors.startDate} required>
                <CustomDatePicker
                  value={form.startDate}
                  onChange={(ds) => set("startDate", ds)}
                  placeholder="Select start date"
                  events={events}
                  birthdays={birthdays}
                  error={!!errors.startDate}
                />
              </Field>
              <Field label="End Date" error={errors.endDate} required>
                <CustomDatePicker
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(ds) => set("endDate", ds)}
                  placeholder="Select end date"
                  events={events}
                  birthdays={birthdays}
                  error={!!errors.endDate}
                />
              </Field>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time (optional)">
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/40 transition"
                />
              </Field>
              <Field label="End Time (optional)" error={errors.endTime}>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                  className={cn(
                    "w-full bg-white/5 border px-3 py-2 text-sm text-white outline-none focus:border-white/40 transition",
                    errors.endTime ? "border-red" : "border-white/10"
                  )}
                />
              </Field>
            </div>

            {/* Location */}
            <Field label="Location (optional)">
              <input
                type="text"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="e.g. Lab 3, Online"
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/40 transition"
              />
            </Field>

            {/* Description */}
            <Field label="Description (optional)">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Add notes..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/40 transition resize-none"
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-red text-white hover:bg-red/80 transition"
            >
              {isEditing ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
        {label}
        {required && <span className="ml-0.5 text-red">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
