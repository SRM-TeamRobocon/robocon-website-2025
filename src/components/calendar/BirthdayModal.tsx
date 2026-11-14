"use client";

import React, { useEffect, useRef } from "react";
import { X, Pencil, Trash2, Cake, Calendar, FileText, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BirthdayOccurrence,
  formatDisplayDateLong,
} from "@/lib/calendar-storage";

interface BirthdayModalProps {
  occurrence: BirthdayOccurrence;
  onClose: () => void;
  onEdit: (occurrence: BirthdayOccurrence) => void;
  onDelete: (id: string) => void;
}

export default function BirthdayModal({
  occurrence,
  onClose,
  onEdit,
  onDelete,
}: BirthdayModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { record, age, statusText, isLeapAdjusted, dateStr } = occurrence;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleDelete() {
    if (window.confirm(`Delete birthday for "${record.name}"? This cannot be undone.`)) {
      onDelete(record.id);
    }
  }

  const fullDobDisplay = formatDisplayDateLong(record.dob);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg bg-black border border-white/10 shadow-2xl">
        {/* Festive top strip */}
        <div className="h-1 bg-amber-400" />

        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-white/10">
          <div className="p-2 border border-amber-500/30 bg-amber-500/10 text-amber-400 shrink-0">
            <Cake className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Birthday
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-white/10 text-white border border-white/15">
                {statusText}
              </span>
            </div>
            <h2 className="text-xl font-black text-white break-words">{record.name}</h2>
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
        <div className="p-5 space-y-4">
          {/* Full Original Date of Birth */}
          <div className="flex items-start gap-3 text-sm">
            <Calendar className="mt-0.5 shrink-0 w-4 h-4 text-amber-400" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Original Date of Birth
              </p>
              <p className="text-white font-medium text-base mt-0.5">
                {fullDobDisplay}
              </p>
            </div>
          </div>

          {/* Age Status Details */}
          <div className="flex items-start gap-3 text-sm">
            <Cake className="mt-0.5 shrink-0 w-4 h-4 text-amber-400" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Age Calculation
              </p>
              <p className="text-gray-200 mt-0.5">
                {age === 0 ? "Born this year" : `${age} years old`} ({statusText})
              </p>
            </div>
          </div>

          {/* Leap Year Notice if applicable */}
          {isLeapAdjusted && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Original DOB is February 29 (Leap Day). Automatically observed on February 28 in this non-leap year.
              </span>
            </div>
          )}

          {/* Description / Notes */}
          {record.description && (
            <div className="flex items-start gap-3 text-sm">
              <FileText className="mt-0.5 shrink-0 w-4 h-4 text-gray-500" />
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Notes
                </p>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap mt-0.5">
                  {record.description}
                </p>
              </div>
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
            onClick={() => onEdit(occurrence)}
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
