"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardList, Check, X, Search } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { RECRUIT_SUBDOMAINS, subDomainLabel, type RecruitSubDomain } from "@/lib/recruit-domains";
import { phoneSearchTerm } from "@/lib/recruit-validation";
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
  const [sort, setSort] = useState<SortState<"name" | "reg_no" | "marks">>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (recruitId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recruitId)) {
        next.delete(recruitId);
      } else {
        next.add(recruitId);
      }
      return next;
    });
  };

  const load = async (d: ExamDomain) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/recruitment/marks?domain=${d}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRows(data.data);
        const nextInputs: Record<string, string> = {};
        const nextNotes: Record<string, string> = {};
        for (const row of data.data as MarksRow[]) {
          nextInputs[row.recruit_id] = row.marks === null ? "" : String(row.marks);
          nextNotes[row.recruit_id] = row.note ?? "";
        }
        setInputs(nextInputs);
        setNoteInputs(nextNotes);
      } else {
        toast.error(data.error || "Could not load recruits");
        setRows([]);
        setNoteInputs({});
      }
    } catch {
      toast.error("Could not load recruits");
      setRows([]);
      setNoteInputs({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    load(domain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, domain]);

  const save = async (recruitId: string) => {
    const raw = inputs[recruitId] ?? "";
    const marks = Number(raw);
    if (raw.trim() === "" || !Number.isInteger(marks) || marks < 0 || marks > 100) {
      toast.error("Enter an integer between 0 and 100");
      return;
    }

    const note = noteInputs[recruitId] ?? "";

    setSavingId(recruitId);
    try {
      const res = await fetch("/api/admin/recruitment/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruit_id: recruitId, sub_domain: domain, marks, note }),
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
        // The server trims the note and turns blank into null, so mirror what it stored back
        // into the input — otherwise a trailing space keeps the row looking permanently dirty.
        setNoteInputs((prev) => ({ ...prev, [recruitId]: savedNote ?? "" }));
      } else {
        toast.error(data.error || "Could not save marks");
      }
    } catch {
      toast.error("Could not save marks");
    } finally {
      setSavingId(null);
    }
  };

  const onSort = (key: "name" | "reg_no" | "marks") => {
    setSort((prev) => nextSortState(prev, key));
  };

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

      return true;
    });

    if (!sort) return filtered;

    const sorted = [...filtered].sort((a, b) => compareBy(a[sort.key], b[sort.key], sort.direction));
    return sorted;
  }, [rows, search, sort, attendanceFilter, yearFilter]);

  const filtersActive =
    search.trim() !== "" || attendanceFilter !== "all" || yearFilter !== "all";

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-red" />
          Marks Entry
        </h1>
        <p className="mt-2 text-gray-400 text-sm max-w-xl">
          Enter written-exam marks per recruit. Attendance is shown for reference only; marks
          can be entered regardless of whether a recruit's QR was scanned.
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
        </div>

        {filtersActive && !loading && (
          <p className="text-xs text-gray-500">
            Showing {visibleRows.length} of {rows.length}
          </p>
        )}
      </div>

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
                {visibleRows.map((row) => {
                  // Save has to light up for a note-only edit too, not just a changed number —
                  // an evaluator who only adds context would otherwise have no way to store it.
                  const dirty =
                    (inputs[row.recruit_id] ?? "") !== (row.marks === null ? "" : String(row.marks)) ||
                    (noteInputs[row.recruit_id] ?? "") !== (row.note ?? "");
                  const expanded = expandedIds.has(row.recruit_id);
                  return (
                    <Fragment key={row.recruit_id}>
                      <tr className="border-b border-white/5 last:border-0">
                        <ExpandToggleCell expanded={expanded} onToggle={() => toggleExpanded(row.recruit_id)}>
                          {row.name}
                        </ExpandToggleCell>
                        <td className="px-5 py-3 text-gray-300">{row.reg_no}</td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={inputs[row.recruit_id] ?? ""}
                            onChange={(e) =>
                              setInputs((prev) => ({ ...prev, [row.recruit_id]: e.target.value }))
                            }
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
                            value={noteInputs[row.recruit_id] ?? ""}
                            onChange={(e) =>
                              setNoteInputs((prev) => ({ ...prev, [row.recruit_id]: e.target.value }))
                            }
                            placeholder="Optional — e.g. answered 3 of 5"
                            className="w-full min-w-[14rem] border-0 bg-white/5 py-1.5 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => save(row.recruit_id)}
                            disabled={savingId === row.recruit_id || !dirty}
                            className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-40 transition"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
