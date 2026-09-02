"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardList, Check, X, Search, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import { useRequireRole } from "@/hooks/use-require-role";
import { RECRUIT_SUBDOMAINS, subDomainLabel, type RecruitSubDomain } from "@/lib/recruit-domains";
import { phoneSearchTerm, parseMarksValue, MARKS_ERROR } from "@/lib/recruit-validation";
import { SortableTh, compareBy, nextSortState, type SortState } from "@/components/recruit/SortableTh";
import { ExpandToggleCell, DetailRow, DetailField } from "@/components/recruit/ExpandableRow";

type ExamDomain = RecruitSubDomain;

interface MarksRow {
  recruit_id: string;
  name: string;
  reg_no: string;
  // Searchable only — never rendered. Evaluators recognise a recruit by the number they
  // were messaged from far faster than by reg no, but the column stays off the table.
  phone: string | null;
  year: string;
  gender: string | null;
  department: string;
  course: string;
  day1: boolean;
  day2: boolean;
  marks: number | null;
  note: string | null;
  evaluator_username: string | null;
  updated_at: string | null;
}

type AttendanceFilter = "all" | "attended" | "absent";
type YearFilter = "all" | "1" | "2";
type GenderFilter = "all" | "male" | "female";

const ATTENDANCE_FILTERS: Array<{ value: AttendanceFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "attended", label: "Attended" },
  { value: "absent", label: "Absent" },
];

// Only years 1 and 2 are recruited, so those are the only options offered. A row carrying
// anything else (bad import, future year) simply matches neither pill and stays visible
// under "All" — never silently dropped from every view.
const YEAR_FILTERS: Array<{ value: YearFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "1", label: "Year 1" },
  { value: "2", label: "Year 2" },
];

// `gender` is nullable on recruit_accounts (rows predating migration 013 may have none), so
// the same rule as Year applies: a null matches neither specific pill but is always reachable
// under "All". Cutoffs are gender-scoped, so filtering here mirrors how marks get judged.
const GENDER_FILTERS: Array<{ value: GenderFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

// Marks are numeric(5,2) since migration 020, restricted to half steps. Rendering the raw
// value could show "72.50"; Number() first so 72.5 reads as "72.5" and 72 as "72".
function marksToInput(marks: number | null): string {
  return marks === null || marks === undefined ? "" : String(Number(marks));
}

// This table is already scoped to one sub-domain, and exam attendance is keyed
// (recruit, cycle, sub_domain) — so a recruit has at most ONE attendance row here and
// `day1`/`day2` are mutually exclusive. Two columns implied both could be ticked; show
// the single day they sat this domain's exam instead.
function ExamAttendance({ day1, day2 }: { day1: boolean; day2: boolean }) {
  const day = day1 ? 1 : day2 ? 2 : null;

  if (day === null) {
    return (
      <span className="inline-flex items-center gap-1 bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-white/10">
        <X className="w-3 h-3" /> Absent
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
      <Check className="w-3 h-3" /> Day {day}
    </span>
  );
}

function DistributionTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || !payload.length) return null;
  const count = payload[0]?.value as number;
  return (
    <div className="border border-white/10 bg-black/90 px-3 py-2 text-xs backdrop-blur-xl">
      <p className="text-gray-400 font-semibold mb-0.5">{label} marks</p>
      <p className="font-bold text-white">
        {count} {count === 1 ? "student" : "students"}
      </p>
    </div>
  );
}

// "31 Aug, 2:14 pm". Deliberately short — this sits under a number input in a dense table,
// so a full timestamp would wrap and push the row height around.
function savedAtLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface MarkRowProps {
  row: MarksRow;
  markValue: string;
  noteValue: string;
  expanded: boolean;
  saving: boolean;
  onMarkChange: (recruitId: string, value: string) => void;
  onNoteChange: (recruitId: string, value: string) => void;
  onToggle: (recruitId: string) => void;
  onSave: (recruitId: string, markValue: string, noteValue: string) => void;
}

// Memoized, and this is load-bearing rather than a micro-optimisation. A popular domain puts
// 600+ recruits in this table, each with two controlled inputs — roughly 6000 DOM nodes. When
// every row was inline JSX, a single keystroke or a save re-reconciled all of them, which is
// what made the page appear to freeze and reload on save.
//
// For memo to actually bite, every prop must be stable or primitive: the parent passes THIS
// row's two values (not the whole `inputs` map), a `saving` boolean (not `savingId`), and
// callbacks that never change identity. The row hands its own values back on save so the
// parent's save handler doesn't need to close over the input maps.
const MarkRow = memo(function MarkRow({
  row,
  markValue,
  noteValue,
  expanded,
  saving,
  onMarkChange,
  onNoteChange,
  onToggle,
  onSave,
}: MarkRowProps) {
  // Save has to light up for a note-only edit too, not just a changed number — an evaluator
  // who only adds context would otherwise have no way to store it.
  const dirty = markValue !== marksToInput(row.marks) || noteValue !== (row.note ?? "");

  return (
    <Fragment>
      <tr className="border-b border-white/5 last:border-0">
        <ExpandToggleCell expanded={expanded} onToggle={() => onToggle(row.recruit_id)}>
          {row.name}
        </ExpandToggleCell>
        <td className="px-5 py-3 text-gray-300">{row.reg_no}</td>
        <td className="px-5 py-3">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={markValue}
            onChange={(e) => onMarkChange(row.recruit_id, e.target.value)}
            className="w-20 border-0 bg-white/5 py-1.5 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
          />
          {row.evaluator_username && (
            <p className="mt-1 text-[10px] text-gray-500 whitespace-nowrap">
              Saved by {row.evaluator_username}
              {row.updated_at ? ` · ${savedAtLabel(row.updated_at)}` : ""}
            </p>
          )}
        </td>
        <td className="px-5 py-3">
          <input
            type="text"
            maxLength={500}
            value={noteValue}
            onChange={(e) => onNoteChange(row.recruit_id, e.target.value)}
            placeholder="Optional — e.g. answered 3 of 5"
            className="w-full min-w-[14rem] border-0 bg-white/5 py-1.5 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
          />
        </td>
        <td className="px-5 py-3 text-right">
          <button
            onClick={() => onSave(row.recruit_id, markValue, noteValue)}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-40 transition"
          >
            <Check className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
          </button>
        </td>
      </tr>
      {expanded && (
        <DetailRow colSpan={5}>
          <DetailField label="Year" value={row.year} />
          <DetailField label="Dept" value={row.department} />
          <DetailField
            label="Exam Attendance"
            value={<ExamAttendance day1={row.day1} day2={row.day2} />}
          />
        </DetailRow>
      )}
    </Fragment>
  );
});

export default function RecruitmentMarksPage() {
  const ready = useRequireRole(["member", "lead", "admin"]);
  const [domain, setDomain] = useState<ExamDomain>("coding");
  const [rows, setRows] = useState<MarksRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all");
  const [yearFilter, setYearFilter] = useState<YearFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [sort, setSort] = useState<SortState<"name" | "reg_no" | "marks">>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showGraph, setShowGraph] = useState(false);

  // Every one of these uses the functional setState form and takes the recruit id as an
  // argument, so their identity never changes and <MarkRow>'s memo holds across renders.
  const toggleExpanded = useCallback((recruitId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recruitId)) next.delete(recruitId);
      else next.add(recruitId);
      return next;
    });
  }, []);

  const onMarkChange = useCallback((recruitId: string, value: string) => {
    setInputs((prev) => ({ ...prev, [recruitId]: value }));
  }, []);

  const onNoteChange = useCallback((recruitId: string, value: string) => {
    setNoteInputs((prev) => ({ ...prev, [recruitId]: value }));
  }, []);

  const load = useCallback(async (d: ExamDomain) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/recruitment/marks?domain=${d}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRows(data.data);
        const nextInputs: Record<string, string> = {};
        const nextNotes: Record<string, string> = {};
        for (const row of data.data as MarksRow[]) {
          nextInputs[row.recruit_id] = marksToInput(row.marks);
          nextNotes[row.recruit_id] = row.note ?? "";
        }
        setInputs(nextInputs);
        setNoteInputs(nextNotes);
      } else {
        toast.error(data.error || "Could not load recruits");
        setRows([]);
        setInputs({});
        setNoteInputs({});
      }
    } catch {
      toast.error("Could not load recruits");
      setRows([]);
      setInputs({});
      setNoteInputs({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    load(domain);
  }, [ready, domain, load]);

  // Takes the row's current values as arguments rather than reading the `inputs` maps, so it
  // only depends on `domain` and stays referentially stable while an evaluator types.
  const save = useCallback(
    async (recruitId: string, rawMarks: string, rawNote: string) => {
      const marks = parseMarksValue(rawMarks);
      if (marks === null) {
        toast.error(MARKS_ERROR);
        return;
      }

      setSavingId(recruitId);
      try {
        const res = await fetch("/api/admin/recruitment/marks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recruit_id: recruitId, sub_domain: domain, marks, note: rawNote }),
        });
        const data = await res.json();
        if (res.ok && data.saved) {
          toast.success("Marks saved");
          // Carry the server's attribution back into the row too, not just `marks` — otherwise
          // the "Saved by ..." line under the input stays stale (or stays absent on a first
          // entry) until someone reloads the page.
          const savedNote: string | null = data.note ?? null;
          setRows((prev) =>
            prev.map((r) =>
              r.recruit_id === recruitId
                ? {
                    ...r,
                    marks,
                    note: savedNote,
                    evaluator_username: data.evaluator_username ?? r.evaluator_username,
                    updated_at: data.updated_at ?? r.updated_at,
                  }
                : r
            )
          );
          // The server trims the note and turns blank into null, and normalises the number,
          // so mirror what it actually stored back into both inputs — otherwise a trailing
          // space or a typed "72.0" keeps the row looking permanently dirty.
          setInputs((prev) => ({ ...prev, [recruitId]: marksToInput(marks) }));
          setNoteInputs((prev) => ({ ...prev, [recruitId]: savedNote ?? "" }));
        } else {
          toast.error(data.error || "Could not save marks");
        }
      } catch {
        toast.error("Could not save marks");
      } finally {
        setSavingId(null);
      }
    },
    [domain]
  );

  const onSort = useCallback((key: "name" | "reg_no" | "marks") => {
    setSort((prev) => nextSortState(prev, key));
  }, []);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Phone is stored as bare 10 digits, so a typed "+91 98765" or "98765-43210" only matches
    // once punctuation is stripped. Name/reg_no still match the raw term — stripping there
    // would break "RA24" style searches.
    const phoneTerm = phoneSearchTerm(search);

    const filtered = rows.filter((row) => {
      if (term) {
        const matches =
          row.name.toLowerCase().includes(term) ||
          row.reg_no.toLowerCase().includes(term) ||
          (phoneTerm !== null && (row.phone ?? "").includes(phoneTerm));
        if (!matches) return false;
      }

      if (attendanceFilter !== "all") {
        const attended = row.day1 || row.day2;
        if (attendanceFilter === "attended" ? !attended : attended) return false;
      }

      if (yearFilter !== "all" && row.year !== yearFilter) return false;

      if (genderFilter !== "all" && row.gender !== genderFilter) return false;

      return true;
    });

    if (!sort) return filtered;

    const sorted = [...filtered].sort((a, b) => compareBy(a[sort.key], b[sort.key], sort.direction));
    return sorted;
  }, [rows, search, sort, attendanceFilter, yearFilter, genderFilter]);

  const filtersActive =
    search.trim() !== "" ||
    attendanceFilter !== "all" ||
    yearFilter !== "all" ||
    genderFilter !== "all";

  // Students-per-mark distribution for whatever is currently on screen. Built from
  // `visibleRows`, so every filter — domain, year, gender, attendance, search — already
  // applies; narrowing to "Year 2 / Female" re-shapes the chart with no extra plumbing.
  //
  // Recruits with no mark entered yet are EXCLUDED rather than counted as zero. Mid-entry
  // that would pile hundreds of un-marked people onto the 0 bar and drown the real shape;
  // the caption reports how many of the filtered set are actually marked instead.
  //
  // The axis runs 0 -> the highest mark actually SCORED under this filter, not 0 -> 100.
  // A domain where the top score so far is 25 gets 51 half-mark bars, not 201 mostly-empty
  // ones. Buckets are 0.5 wide throughout; `marks` is numeric(5,2) restricted to half steps,
  // so `round(mark * 2)` is an exact bucket index with no float drift.
  const distribution = useMemo(() => {
    const marked = visibleRows.filter((r) => r.marks !== null);
    if (marked.length === 0) return null;

    const max = marked.reduce((m, r) => Math.max(m, Number(r.marks)), 0);
    const bucketCount = Math.round(max * 2) + 1;
    const counts = new Array<number>(bucketCount).fill(0);

    for (const r of marked) {
      const index = Math.round(Number(r.marks) * 2);
      if (index >= 0 && index < bucketCount) counts[index] += 1;
    }

    return {
      max,
      markedCount: marked.length,
      data: counts.map((count, i) => ({ label: String(i / 2), Students: count })),
    };
  }, [visibleRows]);

  // Keep the x-axis labels from overlapping once the range gets long — recharts' `interval`
  // is "ticks to SKIP between labels", so 0 means label every bar.
  const tickInterval = distribution
    ? Math.max(0, Math.ceil(distribution.data.length / 24) - 1)
    : 0;

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-red" />
          Marks Entry
        </h1>
        <p className="mt-2 text-gray-400 text-sm max-w-xl">
          Enter written-exam marks per recruit — whole or half marks, 0 to 100. Attendance is
          shown for reference only; marks can be entered regardless of whether a recruit&apos;s
          QR was scanned.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {RECRUIT_SUBDOMAINS.map((d) => (
          <button
            key={d.key}
            onClick={() => setDomain(d.key)}
            className={`px-4 py-2 text-sm font-semibold transition ${
              domain === d.key
                ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                : "text-gray-400 hover:bg-white/5"
            }`}
          >
            {d.label} <span className="text-[10px] font-normal opacity-60">{d.subsystem}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, reg no or phone..."
              className="w-full border-0 bg-white/5 py-2 pl-9 pr-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Exam</span>
            {ATTENDANCE_FILTERS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAttendanceFilter(opt.value)}
                className={`px-4 py-2 text-sm font-semibold transition ${
                  attendanceFilter === opt.value
                    ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                    : "text-gray-400 hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Year</span>
            {YEAR_FILTERS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setYearFilter(opt.value)}
                className={`px-4 py-2 text-sm font-semibold transition ${
                  yearFilter === opt.value
                    ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                    : "text-gray-400 hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Gender</span>
            {GENDER_FILTERS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGenderFilter(opt.value)}
                className={`px-4 py-2 text-sm font-semibold transition ${
                  genderFilter === opt.value
                    ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                    : "text-gray-400 hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowGraph((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${
              showGraph
                ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                : "text-gray-400 hover:bg-white/5"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {showGraph ? "Hide graph" : "Show graph"}
          </button>
        </div>

        {filtersActive && !loading && (
          <p className="text-xs text-gray-500">
            Showing {visibleRows.length} of {rows.length}
          </p>
        )}
      </div>

      {showGraph && !loading && (
        <div className="border border-white/10 bg-black">
          <div className="p-5 pb-0">
            <h2 className="text-lg font-bold text-white">Marks Distribution</h2>
            <p className="mt-1 text-xs text-gray-500">
              {distribution
                ? `Students per mark for the current filter — ${distribution.markedCount} of ${visibleRows.length} marked so far. Axis runs 0 to ${distribution.max}, the highest mark scored here, in steps of 0.5. Recruits with no mark entered are not counted.`
                : "Students per mark for the current filter."}
            </p>
          </div>

          {distribution === null ? (
            <p className="p-8 text-center text-sm text-gray-500">
              No marks entered yet for this filter — nothing to plot.
            </p>
          ) : (
            <div className="px-5 py-4" style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={distribution.data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={tickInterval}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={DistributionTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="Students" fill="#3987e5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="border border-white/10 bg-black">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No recruits selected {subDomainLabel(domain)}.
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No recruits match your search or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                  <SortableTh label="Name" sortKey="name" sort={sort} onSort={onSort} />
                  <SortableTh label="Reg No" sortKey="reg_no" sort={sort} onSort={onSort} />
                  <SortableTh label="Marks" sortKey="marks" sort={sort} onSort={onSort} />
                  <th className="px-5 py-3">Note</th>
                  <th className="px-5 py-3 text-right">Save</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <MarkRow
                    key={row.recruit_id}
                    row={row}
                    markValue={inputs[row.recruit_id] ?? ""}
                    noteValue={noteInputs[row.recruit_id] ?? ""}
                    expanded={expandedIds.has(row.recruit_id)}
                    saving={savingId === row.recruit_id}
                    onMarkChange={onMarkChange}
                    onNoteChange={onNoteChange}
                    onToggle={toggleExpanded}
                    onSave={save}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
