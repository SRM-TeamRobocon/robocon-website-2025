"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, AlertCircle, Cake } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BirthdayRecord,
  NewBirthdayRecord,
  toDateStr,
} from "@/lib/calendar-storage";
import CustomDatePicker from "./CustomDatePicker";

interface BirthdayFormModalProps {
  initialBirthday?: BirthdayRecord;
  onClose: () => void;
  onSave: (data: NewBirthdayRecord) => void;
}

interface FormState {
  name: string;
  dob: string;
  description: string;
}

function initialState(bday?: BirthdayRecord): FormState {
  if (bday) {
    return {
      name: bday.name,
      dob: bday.dob,
      description: bday.description || "",
    };
  }
  return {
    name: "",
    dob: "",
    description: "",
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = "Person's name is required.";
  if (!form.dob) {
    errors.dob = "Complete date of birth is required.";
  } else {
    const parts = form.dob.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      errors.dob = "Invalid date format.";
    } else {
      const today = toDateStr(new Date());
      if (form.dob > today) {
        errors.dob = "Date of birth cannot be in the future.";
      }
    }
  }
  return errors;
}

export default function BirthdayFormModal({
  initialBirthday,
  onClose,
  onSave,
}: BirthdayFormModalProps) {
  const [form, setForm] = useState<FormState>(initialState(initialBirthday));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const isEditing = !!initialBirthday;

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50);
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
      name: form.name.trim(),
      dob: form.dob,
      description: form.description.trim(),
    });
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  const currentYear = new Date().getFullYear();

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-black border border-white/10 shadow-2xl my-4">
        {/* Festive top strip */}
        <div className="h-1 bg-amber-400" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest">
                {isEditing ? "Edit Birthday" : "Add Birthday"}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Automatically recurs every calendar year with live age updates.
              </p>
            </div>
          </div>
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
            {/* Person's Name */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                Person's Name <span className="text-red">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Aadish Sood"
                className={cn(
                  "w-full bg-white/5 border px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/40 transition",
                  errors.name ? "border-red" : "border-white/10"
                )}
              />
              {errors.name && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Date of Birth with Custom Date Picker */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                Date of Birth (including Year) <span className="text-red">*</span>
              </label>
              <CustomDatePicker
                value={form.dob}
                onChange={(ds) => set("dob", ds)}
                placeholder="Select date of birth"
                minYear={1920}
                maxYear={currentYear}
                max={toDateStr(new Date())}
                error={!!errors.dob}
              />
              {errors.dob ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-red">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {errors.dob}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-gray-500">
                  Select the year from the dropdown above to jump to older birth years quickly.
                </p>
              )}
            </div>

            {/* Description / Notes */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="e.g. Lead Mechanical, likes chocolate cake"
                rows={3}
                className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/40 transition resize-none"
              />
            </div>
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
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition flex items-center gap-1.5"
            >
              <Cake className="w-3.5 h-3.5" />
              {isEditing ? "Save Changes" : "Save Birthday"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
