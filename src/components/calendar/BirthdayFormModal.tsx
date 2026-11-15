"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Cake, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BirthdayRecord,
  NewBirthdayRecord,
} from "@/lib/calendar-storage";

interface BirthdayFormModalProps {
  initialBirthday?: BirthdayRecord;
  onClose: () => void;
  onSave: (data: NewBirthdayRecord) => void;
}

const MONTHS = [
  { val: "1", label: "January" },
  { val: "2", label: "February" },
  { val: "3", label: "March" },
  { val: "4", label: "April" },
  { val: "5", label: "May" },
  { val: "6", label: "June" },
  { val: "7", label: "July" },
  { val: "8", label: "August" },
  { val: "9", label: "September" },
  { val: "10", label: "October" },
  { val: "11", label: "November" },
  { val: "12", label: "December" },
];

const REMIND_ME_OPTIONS = ["On the day", "1 day before", "1 week before"] as const;

function getNextBirthdaySummary(dayStr: string, monthStr: string, yearStr: string): string {
  if (!dayStr || !monthStr || !yearStr.trim()) return "";
  const d = parseInt(dayStr, 10);
  const m = parseInt(monthStr, 10);
  const y = parseInt(yearStr.trim(), 10);
  const currentYear = new Date().getFullYear();
  if (isNaN(d) || isNaN(m) || isNaN(y) || y < 1900 || y > currentYear || yearStr.trim().length !== 4) {
    return "";
  }

  const monthShort = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  const mName = monthShort[m - 1] || "";

  const now = new Date();
  const thisYearBday = new Date(currentYear, m - 1, d);
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let nextYear = currentYear;
  if (thisYearBday < todayDate) {
    nextYear = currentYear + 1;
  }
  const nextAge = nextYear - y;
  return `TURNS ${nextAge} ON ${d} ${mName}`;
}

export default function BirthdayFormModal({
  initialBirthday,
  onClose,
  onSave,
}: BirthdayFormModalProps) {
  const isEditing = !!initialBirthday;
  const currentYear = new Date().getFullYear();

  // Split initial DOB if editing
  const initDobParts = initialBirthday?.dob ? initialBirthday.dob.split("-") : [];
  const rawYear = initDobParts[0];
  // If year is absent or dummy, start with empty so required rule applies
  const initYear = rawYear && rawYear !== "0000" && parseInt(rawYear, 10) >= 1900 ? rawYear : "";
  const initMonth = initDobParts[1] ? String(parseInt(initDobParts[1], 10)) : String(new Date().getMonth() + 1);
  const initDay = initDobParts[2] ? String(parseInt(initDobParts[2], 10)) : String(new Date().getDate());

  const [name, setName] = useState(initialBirthday?.name || "");
  const [day, setDay] = useState(initDay);
  const [month, setMonth] = useState(initMonth);
  const [year, setYear] = useState(initYear);
  const [remindMe, setRemindMe] = useState<string>("On the day");
  const [description, setDescription] = useState(initialBirthday?.description || "");

  // Form errors
  const [errors, setErrors] = useState<{
    name?: string;
    day?: string;
    month?: string;
    year?: string;
  }>({});
  const [touchedYear, setTouchedYear] = useState(false);

  // Mini year picker state
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rangeStart, setRangeStart] = useState<number>(() => {
    if (initYear && parseInt(initYear, 10) >= 1900) {
      return Math.floor((parseInt(initYear, 10) - 1900) / 12) * 12 + 1900;
    }
    return Math.max(1900, currentYear - 11);
  });
  const [focusedPickerYear, setFocusedPickerYear] = useState<number>(() => {
    if (initYear && parseInt(initYear, 10) >= 1900) return parseInt(initYear, 10);
    return currentYear;
  });

  const overlayRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLSelectElement>(null);
  const monthRef = useRef<HTMLSelectElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);
  const yearInputWrapperRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  }, []);

  // Escape key closes modal (or picker if open)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (yearPickerOpen) {
          setYearPickerOpen(false);
          yearInputRef.current?.focus();
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, yearPickerOpen]);

  // Position popover directly under the birth year input (4px gap)
  useLayoutEffect(() => {
    if (!yearPickerOpen) return;
    function updateCoords() {
      if (!yearInputWrapperRef.current) return;
      const rect = yearInputWrapperRef.current.getBoundingClientRect();
      const popupWidth = 260;
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 12) {
        left = window.innerWidth - popupWidth - 12;
      }
      if (left < 12) left = 12;

      let top = rect.bottom + 4;
      const popupHeight = 250;
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
  }, [yearPickerOpen]);

  // Click outside to close year picker
  useEffect(() => {
    if (!yearPickerOpen) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        yearInputWrapperRef.current &&
        !yearInputWrapperRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setYearPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [yearPickerOpen]);

  // Keyboard navigation inside Year Picker
  useEffect(() => {
    if (!yearPickerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedPickerYear((y) => Math.max(1900, y - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedPickerYear((y) => Math.min(currentYear, y + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedPickerYear((y) => Math.max(1900, y - 3));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedPickerYear((y) => Math.min(currentYear, y + 3));
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectYear(focusedPickerYear);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [yearPickerOpen, focusedPickerYear, currentYear]);

  // Keep range in sync with focused year or typed input
  function openYearPicker() {
    const parsed = parseInt(year, 10);
    if (!isNaN(parsed) && parsed >= 1900 && parsed <= currentYear) {
      setRangeStart(Math.floor((parsed - 1900) / 12) * 12 + 1900);
      setFocusedPickerYear(parsed);
    } else {
      setRangeStart(Math.max(1900, currentYear - 11));
      setFocusedPickerYear(currentYear);
    }
    setYearPickerOpen(true);
  }

  function validateYearVal(val: string): string | undefined {
    if (!val.trim()) {
      return "Enter a birth year";
    }
    const y = parseInt(val.trim(), 10);
    if (isNaN(y) || val.trim().length !== 4 || y < 1900 || y > currentYear) {
      return `Enter a year between 1900 and ${currentYear}`;
    }
    return undefined;
  }

  function selectYear(selectedY: number) {
    if (selectedY > currentYear || selectedY < 1900) return;
    const str = String(selectedY);
    setYear(str);
    setErrors((prev) => ({ ...prev, year: undefined }));
    setYearPickerOpen(false);
    yearInputRef.current?.focus();
  }

  function handleYearChange(input: string) {
    const digits = input.replace(/\D/g, "").slice(0, 4);
    setYear(digits);

    // Live update year picker highlight if open
    if (digits.length === 4) {
      const y = parseInt(digits, 10);
      if (y >= 1900 && y <= currentYear) {
        setRangeStart(Math.floor((y - 1900) / 12) * 12 + 1900);
        setFocusedPickerYear(y);
        setErrors((prev) => ({ ...prev, year: undefined }));
      }
    } else if (touchedYear) {
      setErrors((prev) => ({ ...prev, year: validateYearVal(digits) }));
    }
  }

  function handleYearBlur() {
    setTouchedYear(true);
    const err = validateYearVal(year);
    setErrors((prev) => ({ ...prev, year: err }));
  }

  function validateAll(): { valid: boolean; firstErrorField?: string } {
    const newErrors: { name?: string; day?: string; month?: string; year?: string } = {};

    if (!name.trim()) {
      newErrors.name = "Enter a name";
    }
    const d = parseInt(day, 10);
    if (isNaN(d) || d < 1 || d > 31) {
      newErrors.day = "Select a day";
    }
    const m = parseInt(month, 10);
    if (isNaN(m) || m < 1 || m > 12) {
      newErrors.month = "Select a month";
    }

    const yearErr = validateYearVal(year);
    if (yearErr) {
      newErrors.year = yearErr;
    }

    setErrors(newErrors);

    if (newErrors.name) return { valid: false, firstErrorField: "name" };
    if (newErrors.day) return { valid: false, firstErrorField: "day" };
    if (newErrors.month) return { valid: false, firstErrorField: "month" };
    if (newErrors.year) return { valid: false, firstErrorField: "year" };

    return { valid: true };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouchedYear(true);

    const { valid, firstErrorField } = validateAll();
    if (!valid) {
      if (firstErrorField === "name") nameRef.current?.focus();
      else if (firstErrorField === "day") dayRef.current?.focus();
      else if (firstErrorField === "month") monthRef.current?.focus();
      else if (firstErrorField === "year") yearInputRef.current?.focus();
      return;
    }

    // Compose DOB with validated 4-digit year
    const yearPart = year.trim().padStart(4, "0");
    const monthPart = String(parseInt(month, 10)).padStart(2, "0");
    const dayPart = String(parseInt(day, 10)).padStart(2, "0");
    const dob = `${yearPart}-${monthPart}-${dayPart}`;

    onSave({
      name: name.trim(),
      dob,
      description: description.trim(),
    });
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  const footerSummary = getNextBirthdaySummary(day, month, year);

  // Year range calculation
  const rangeEnd = Math.min(rangeStart + 11, currentYear + (11 - ((currentYear - rangeStart) % 12 || 12)));
  const canGoLeft = rangeStart > 1900;
  const canGoRight = rangeStart + 12 <= currentYear;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.82)" }}
    >
      {/* Modal Container: max-width 460px, background #050505, 1px #2a2a2a border, 2px YELLOW top border, no rounded corners */}
      <div className="relative w-full max-w-[460px] bg-[#050505] border border-[#2a2a2a] border-t-2 border-t-[#f5b301] shadow-2xl my-4 rounded-none">
        {/* Header row: cake icon + "ADD BIRTHDAY" in yellow (#f5b301), X button, 1px #1f1f1f bottom border */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2">
            <Cake className="w-4 h-4 text-[#f5b301]" />
            <h2 className="text-[13px] font-bold text-[#f5b301] uppercase tracking-[0.1em]">
              {isEditing ? "EDIT BIRTHDAY" : "ADD BIRTHDAY"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#9aa1ad] hover:text-white transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5b301]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Body: padding 16px, 14px gaps */}
          <div className="p-4 space-y-[14px]">
            {/* Person's Name */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                NAME <span className="text-[#f5b301]">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name && e.target.value.trim()) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="e.g. John Doe"
                className={cn(
                  "w-full bg-[#000000] border px-[10px] py-[9px] text-[13px] text-[#e8e8e8] placeholder-[#6b7280] outline-none rounded-none transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5b301]",
                  errors.name ? "border-[#f5b301]" : "border-[#2a2a2a] focus:border-[#555]"
                )}
              />
              {errors.name && (
                <p className="mt-1 text-[11px] text-[#f5b301]">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Row of Day, Month, Birth Year */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
              {/* Day */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                  DAY <span className="text-[#f5b301]">*</span>
                </label>
                <select
                  ref={dayRef}
                  value={day}
                  onChange={(e) => {
                    setDay(e.target.value);
                    if (errors.day) setErrors((prev) => ({ ...prev, day: undefined }));
                  }}
                  className={cn(
                    "w-full bg-[#000000] border px-[10px] py-[9px] text-[13px] text-[#e8e8e8] outline-none rounded-none transition cursor-pointer appearance-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5b301]",
                    errors.day ? "border-[#f5b301]" : "border-[#2a2a2a] focus:border-[#555]"
                  )}
                >
                  {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                    <option key={d} value={d} className="bg-black text-[#e8e8e8]">
                      Day {d}
                    </option>
                  ))}
                </select>
                {errors.day && (
                  <p className="mt-1 text-[11px] text-[#f5b301]">
                    {errors.day}
                  </p>
                )}
              </div>

              {/* Month */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                  MONTH <span className="text-[#f5b301]">*</span>
                </label>
                <select
                  ref={monthRef}
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    if (errors.month) setErrors((prev) => ({ ...prev, month: undefined }));
                  }}
                  className={cn(
                    "w-full bg-[#000000] border px-[10px] py-[9px] text-[13px] text-[#e8e8e8] outline-none rounded-none transition cursor-pointer appearance-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5b301]",
                    errors.month ? "border-[#f5b301]" : "border-[#2a2a2a] focus:border-[#555]"
                  )}
                >
                  {MONTHS.map((m) => (
                    <option key={m.val} value={m.val} className="bg-black text-[#e8e8e8]">
                      {m.label}
                    </option>
                  ))}
                </select>
                {errors.month && (
                  <p className="mt-1 text-[11px] text-[#f5b301]">
                    {errors.month}
                  </p>
                )}
              </div>

              {/* Birth Year (CHANGE 2 & CHANGE 3: Required, typed or picked from mini calendar) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                  BIRTH YEAR <span className="text-[#f5b301]">*</span>
                </label>
                <div ref={yearInputWrapperRef} className="relative w-full">
                  <div
                    className={cn(
                      "w-full flex items-center justify-between bg-[#000000] border px-[10px] py-[9px] text-[13px] text-[#e8e8e8] outline-none rounded-none transition",
                      errors.year || yearPickerOpen
                        ? "border-[#f5b301]"
                        : "border-[#2a2a2a] focus-within:border-[#555]"
                    )}
                  >
                    <input
                      ref={yearInputRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={year}
                      placeholder="2004"
                      onFocus={openYearPicker}
                      onClick={openYearPicker}
                      onChange={(e) => handleYearChange(e.target.value)}
                      onBlur={handleYearBlur}
                      className="w-full bg-transparent text-[#e8e8e8] placeholder-[#6b7280] outline-none text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (yearPickerOpen) {
                          setYearPickerOpen(false);
                        } else {
                          openYearPicker();
                        }
                      }}
                      aria-label="Pick a year"
                      className="p-0.5 text-[#6b7280] hover:text-[#f5b301] transition cursor-pointer shrink-0"
                    >
                      <CalendarIcon
                        className={cn("w-4 h-4 transition-colors", yearPickerOpen && "text-[#f5b301]")}
                      />
                    </button>
                  </div>
                </div>

                {errors.year && (
                  <p className="mt-1 text-[11px] text-[#f5b301]">
                    {errors.year}
                  </p>
                )}
              </div>
            </div>

            {/* "Remind me" chip row: "On the day", "1 day before", "1 week before" */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                REMIND ME
              </label>
              <div className="flex items-center gap-2">
                {REMIND_ME_OPTIONS.map((opt) => {
                  const isSelected = remindMe === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setRemindMe(opt)}
                      className={cn(
                        "flex-1 py-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.07em] border transition cursor-pointer rounded-none text-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5b301]",
                        isSelected
                          ? "border-[#f5b301] text-[#f5b301] bg-[#1a1405]"
                          : "border-[#2a2a2a] bg-[#000000] text-[#9aa1ad] hover:border-[#444]"
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note: about 48px tall, placeholder "Gift idea, favorite cake..." */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1.5">
                NOTE
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Gift idea, favorite cake..."
                className="w-full h-[48px] bg-[#000000] border border-[#2a2a2a] px-[10px] py-[8px] text-[13px] text-[#e8e8e8] placeholder-[#6b7280] outline-none focus:border-[#555] rounded-none resize-none transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5b301]"
              />
            </div>
          </div>

          {/* Footer: 1px #1f1f1f top border, left summary ("TURNS N ON D MON"), right CANCEL and solid yellow SAVE BIRTHDAY button */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1f1f1f] bg-[#050505]">
            <span className="text-[10px] text-[#6b7280] uppercase tracking-[0.07em] truncate mr-2 font-medium">
              {footerSummary}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.07em] border border-[#2a2a2a] text-[#9aa1ad] hover:text-white hover:border-[#444] transition rounded-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5b301]"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.07em] bg-[#f5b301] text-black hover:bg-[#d99e00] transition rounded-none cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-black"
              >
                SAVE BIRTHDAY
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Mini Year Calendar Popover: about 260px wide, #0a0a0a bg, 1px #2a2a2a border, 2px yellow top border */}
      {yearPickerOpen &&
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
            className="border border-[#2a2a2a] border-t-2 border-t-[#f5b301] bg-[#0a0a0a] p-[10px] shadow-2xl select-none animate-in fade-in duration-150 rounded-none"
          >
            {/* Header: left arrow, range like "2004 - 2015", right arrow */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                disabled={!canGoLeft}
                onClick={() => setRangeStart((r) => Math.max(1900, r - 12))}
                className={cn(
                  "p-1 text-[#9aa1ad] hover:text-white transition",
                  !canGoLeft && "opacity-30 pointer-events-none cursor-not-allowed"
                )}
                aria-label="Previous 12 years"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#e8e8e8]">
                {rangeStart} – {rangeStart + 11}
              </span>

              <button
                type="button"
                disabled={!canGoRight}
                onClick={() => setRangeStart((r) => r + 12)}
                className={cn(
                  "p-1 text-[#9aa1ad] hover:text-white transition",
                  !canGoRight && "opacity-30 pointer-events-none cursor-not-allowed"
                )}
                aria-label="Next 12 years"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body: 3-column by 4-row grid of year buttons */}
            <div className="grid grid-cols-3 gap-1.5 my-1">
              {Array.from({ length: 12 }, (_, i) => rangeStart + i).map((yr) => {
                const isSelected = String(yr) === year.trim();
                const isCurrent = yr === currentYear;
                const isFuture = yr > currentYear;
                const isKeyFocused = focusedPickerYear === yr;

                return (
                  <button
                    key={yr}
                    type="button"
                    disabled={isFuture}
                    onClick={() => selectYear(yr)}
                    className={cn(
                      "h-[36px] flex items-center justify-center text-[11px] font-bold tracking-[0.07em] border border-transparent rounded-none transition cursor-pointer",
                      isFuture && "text-[#4b5563] opacity-40 cursor-not-allowed",
                      !isFuture && isSelected && "bg-[#f5b301] text-black font-bold",
                      !isFuture && !isSelected && isCurrent && "outline outline-1 outline-[#f5b301] text-white",
                      !isFuture && !isSelected && !isCurrent && "text-[#e8e8e8] hover:bg-[#1a1a1a]",
                      !isFuture && !isSelected && isKeyFocused && "bg-[#1a1a1a]"
                    )}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>

            {/* Footer: "CLEAR" left (#9aa1ad) and "THIS YEAR" right (yellow text) */}
            <div className="mt-2.5 pt-2 border-t border-[#1f1f1f] flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.07em]">
              <button
                type="button"
                onClick={() => {
                  setYear("");
                  setErrors((prev) => ({ ...prev, year: undefined }));
                  setYearPickerOpen(false);
                  yearInputRef.current?.focus();
                }}
                className="text-[#9aa1ad] hover:text-white transition"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => {
                  setRangeStart(Math.max(1900, currentYear - 11));
                  setFocusedPickerYear(currentYear);
                }}
                className="text-[#f5b301] hover:underline transition"
              >
                THIS YEAR
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
