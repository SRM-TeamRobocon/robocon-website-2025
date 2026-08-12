"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";
export type SortState<K extends string> = { key: K; direction: SortDirection } | null;

// Drop-in replacement for a plain `<th>` in the admin recruitment tables. Renders the
// label plus a click target that cycles asc -> desc -> asc, with a chevron showing the
// current direction (or a neutral up/down glyph when this column isn't the active sort).
// Sorting itself stays in the page — this component only owns the header UI, since every
// table's row shape and comparator differ.
export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
  align = "left",
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort!.direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  const justify = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";

  return (
    <th className={`px-5 py-3 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 ${justify} w-full font-bold uppercase tracking-widest hover:text-white transition-colors ${
          active ? "text-white" : "text-gray-500"
        }`}
      >
        {label}
        <Icon className={`w-3 h-3 shrink-0 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    </th>
  );
}

// Generic stable-ish comparator: strings compare case-insensitively, numbers compare
// numerically, everything else falls back to string coercion. Nulls/undefined sort last
// regardless of direction so missing data doesn't jump to the top on desc.
export function compareBy<T>(a: T, b: T, dir: SortDirection): number {
  const av = a as unknown;
  const bv = b as unknown;
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;

  let cmp: number;
  if (typeof av === "number" && typeof bv === "number") {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true });
  }
  return dir === "asc" ? cmp : -cmp;
}

// Cycles a column's sort state on click: unsorted/other-column -> asc -> desc -> asc.
export function nextSortState<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (!current || current.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}
