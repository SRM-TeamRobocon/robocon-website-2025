"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimePickerProps {
  value: string; // 24-hr format "HH:mm"
  onChange: (time24: string) => void;
  error?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export function formatTime24To12(time24: string): string {
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

export function parseTypedTime(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return "";

  // 12-hour: e.g. "9:30 am", "9:30am", "9 am", "9am", "12:00pm"
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = m12[2] ? parseInt(m12[2], 10) : 0;
    const ampm = m12[3];
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      if (ampm === "pm" && h < 12) h += 12;
      if (ampm === "am" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // 24-hour: e.g. "21:00", "09:30", "14:15", "8:00"
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // Bare number: e.g. "9", "14"
  const mBare = s.match(/^(\d{1,2})$/);
  if (mBare) {
    const h = parseInt(mBare[1], 10);
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, "0")}:00`;
    }
  }

  return null;
}

export default function TimePicker({
  value,
  onChange,
  error = false,
  disabled = false,
  placeholder = "09:00 AM",
  id,
  className = "",
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inputValue, setInputValue] = useState(formatTime24To12(value));

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  // Parse current value into 12-hour components
  const parsed = (() => {
    if (!value) return { hour: 9, minute: "00", ampm: "AM" as "AM" | "PM" };
    const [hStr, mStr] = value.split(":");
    let h = parseInt(hStr, 10);
    if (isNaN(h)) h = 9;
    const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    const mNum = parseInt(mStr || "0", 10);
    // Find closest 5-minute bucket for picker highlight
    const roundedM = Math.round(mNum / 5) * 5;
    const m = String(Math.min(55, Math.max(0, roundedM))).padStart(2, "0");
    return { hour: h12, minute: m, ampm };
  })();

  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedAmPm, setSelectedAmPm] = useState<"AM" | "PM">(parsed.ampm);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync when value changes outside
  useEffect(() => {
    setInputValue(formatTime24To12(value));
    if (value) {
      const [hStr, mStr] = value.split(":");
      let h = parseInt(hStr, 10);
      if (!isNaN(h)) {
        const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
        let h12 = h % 12;
        if (h12 === 0) h12 = 12;
        const mNum = parseInt(mStr || "0", 10);
        const roundedM = Math.round(mNum / 5) * 5;
        const m = String(Math.min(55, Math.max(0, roundedM))).padStart(2, "0");
        setSelectedHour(h12);
        setSelectedMinute(m);
        setSelectedAmPm(ampm);
      }
    }
  }, [value]);

  // Position calculation directly under trigger
  useLayoutEffect(() => {
    if (!open) return;
    function updateCoords() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popupWidth = 270;
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 12) {
        left = window.innerWidth - popupWidth - 12;
      }
      if (left < 12) left = 12;

      let top = rect.bottom + 4;
      const popupHeight = 290;
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
  }, [open]);

  // Outside click & Escape
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function applyTime(h12: number, minStr: string, ampm: "AM" | "PM") {
    let h24 = h12;
    if (ampm === "PM" && h24 < 12) h24 += 12;
    if (ampm === "AM" && h24 === 12) h24 = 0;
    const time24 = `${String(h24).padStart(2, "0")}:${minStr.padStart(2, "0")}`;
    onChange(time24);
  }

  function handleSelectHour(h: number) {
    setSelectedHour(h);
    applyTime(h, selectedMinute, selectedAmPm);
  }

  function handleSelectMinute(m: string) {
    setSelectedMinute(m);
    applyTime(selectedHour, m, selectedAmPm);
  }

  function handleSelectAmPm(ap: "AM" | "PM") {
    setSelectedAmPm(ap);
    applyTime(selectedHour, selectedMinute, ap);
  }

  function handleQuickPick(preset: string) {
    if (preset === "NOW") {
      const now = new Date();
      const h24 = now.getHours();
      const m = String(now.getMinutes()).padStart(2, "0");
      onChange(`${String(h24).padStart(2, "0")}:${m}`);
      setOpen(false);
      return;
    }
    const parsedTime = parseTypedTime(preset);
    if (parsedTime) {
      onChange(parsedTime);
      setOpen(false);
    }
  }

  function handleInputBlur() {
    if (!inputValue.trim()) {
      onChange("");
      return;
    }
    const parsedTime = parseTypedTime(inputValue);
    if (parsedTime) {
      onChange(parsedTime);
      setInputValue(formatTime24To12(parsedTime));
    } else {
      setInputValue(formatTime24To12(value));
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInputBlur();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative w-full">
      {/* Input container */}
      <div
        ref={triggerRef}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between bg-[#000000] border px-[10px] py-[9px] text-[13px] text-[#e8e8e8] outline-none rounded-none transition cursor-pointer",
          error
            ? "border-[#cc0000]"
            : open
            ? "border-[#cc0000]"
            : "border-[#2a2a2a] hover:border-[#444]",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <input
          id={id}
          type="text"
          disabled={disabled}
          value={inputValue}
          placeholder={placeholder}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent text-[#e8e8e8] text-[13px] placeholder-[#6b7280] outline-none w-full"
        />
        <Clock
          className={cn(
            "w-4 h-4 shrink-0 transition-colors",
            open ? "text-[#cc0000]" : "text-[#6b7280]"
          )}
        />
      </div>

      {/* Popover under field: width 270px, background #0a0a0a, 1px #2a2a2a border, 2px red top border */}
      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 270,
              zIndex: 9999,
            }}
            className="border border-[#2a2a2a] border-t-2 border-t-[#cc0000] bg-[#0a0a0a] p-[10px] shadow-2xl select-none animate-in fade-in duration-150"
          >
            {/* Three columns: Hour, Min, AM/PM */}
            <div className="grid grid-cols-[1fr_1fr_64px] gap-2 pb-2 border-b border-[#1f1f1f]">
              {/* Hour column */}
              <div>
                <span className="block text-[9px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1 text-center">
                  HOUR
                </span>
                <div className="max-h-[140px] overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                  {HOURS.map((h) => {
                    const isSelected = selectedHour === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleSelectHour(h)}
                        className={cn(
                          "w-full py-1 text-center text-[11px] font-bold rounded-none transition",
                          isSelected
                            ? "bg-[#cc0000] text-white"
                            : "text-[#9aa1ad] hover:text-white hover:bg-[#1a1a1a]"
                        )}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Min column */}
              <div>
                <span className="block text-[9px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1 text-center">
                  MIN
                </span>
                <div className="max-h-[140px] overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                  {MINUTES.map((m) => {
                    const isSelected = selectedMinute === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSelectMinute(m)}
                        className={cn(
                          "w-full py-1 text-center text-[11px] font-bold rounded-none transition",
                          isSelected
                            ? "bg-[#cc0000] text-white"
                            : "text-[#9aa1ad] hover:text-white hover:bg-[#1a1a1a]"
                        )}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AM / PM column: narrow 64px with two stacked boxes */}
              <div className="w-[64px]">
                <span className="block text-[9px] font-bold uppercase tracking-[0.07em] text-[#6b7280] mb-1 text-center">
                  AM / PM
                </span>
                <div className="flex flex-col gap-1.5 pt-0.5">
                  {(["AM", "PM"] as const).map((ap) => {
                    const isSelected = selectedAmPm === ap;
                    return (
                      <button
                        key={ap}
                        type="button"
                        onClick={() => handleSelectAmPm(ap)}
                        className={cn(
                          "w-full py-2.5 text-center text-[12px] font-bold border rounded-none transition",
                          isSelected
                            ? "border-[#cc0000] bg-[#cc0000] text-white"
                            : "border-[#2a2a2a] bg-[#000000] text-[#9aa1ad] hover:text-white hover:border-[#444]"
                        )}
                      >
                        {ap}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick-pick chips: "NOW", "9:00 AM", "12:00 PM", "5:00 PM" */}
            <div className="grid grid-cols-4 gap-1 py-2 border-b border-[#1f1f1f]">
              {["NOW", "9:00 AM", "12:00 PM", "5:00 PM"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleQuickPick(preset)}
                  className="py-1 px-1 text-center text-[10px] font-bold uppercase tracking-[0.07em] border border-[#2a2a2a] bg-[#000000] text-[#9aa1ad] hover:text-white hover:border-[#444] rounded-none transition"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Footer: hint left, solid red "DONE" right */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[10px] text-[#6b7280] normal-case">
                Or type: 9:00 am
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1 bg-[#cc0000] text-white text-[10px] font-bold uppercase tracking-[0.07em] hover:bg-[#aa0000] rounded-none transition cursor-pointer"
              >
                DONE
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
