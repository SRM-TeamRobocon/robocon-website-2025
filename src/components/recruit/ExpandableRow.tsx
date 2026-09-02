"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

// Click target for expanding a table row: wraps the row's primary identity cell (usually
// the name) in a button with a chevron that rotates open. Only this cell is clickable -
// deliberately not the whole <tr> - so buttons/inputs elsewhere in the row (Save, Edit,
// Override, WhatsApp) never need onClick stopPropagation gymnastics to avoid double-firing.
export function ExpandToggleCell({
  expanded,
  onToggle,
  children,
  className = "",
}: {
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-left text-white font-medium hover:text-red transition-colors"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 shrink-0 text-gray-500 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
        {children}
      </button>
    </td>
  );
}

// The expanded detail panel - a full-width row directly under the toggled row, holding
// whatever columns were moved off the main table to keep it from overflowing horizontally.
export function DetailRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr className="border-b border-white/5 bg-white/[0.02]">
      <td colSpan={colSpan} className="px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">{children}</div>
      </td>
    </tr>
  );
}

export function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</div>
      <div className="text-sm text-gray-200">{value}</div>
    </div>
  );
}
