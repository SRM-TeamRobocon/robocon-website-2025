"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardList, Check, X, Search } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { RECRUIT_SUBDOMAINS, subDomainLabel, type RecruitSubDomain } from "@/lib/recruit-domains";
import { SortableTh, compareBy, nextSortState, type SortState } from "@/components/recruit/SortableTh";
import { ExpandToggleCell, DetailRow, DetailField } from "@/components/recruit/ExpandableRow";

type ExamDomain = RecruitSubDomain;

interface MarksRow {
  recruit_id: string;
  name: string;
  reg_no: string;
  year: string;
  department: string;
  course: string;
  day1: boolean;
  day2: boolean;
  marks: number | null;
  evaluator_username: string | null;
  updated_at: string | null;
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

// A `border` doesn't render along a clip-path's angled edge, so the border is faked with
// a `::before` pseudo-element instead: same clip-path, inset -1px so its color peeks out
// uniformly around the real box, including along the diagonal cut corner.
const CARD_CLIP = "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)";

export default function RecruitmentMarksPage() {
  const ready = useRequireRole(["member", "lead", "admin"]);
  const [domain, setDomain] = useState<ExamDomain>("coding");
  const [rows, setRows] = useState<MarksRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
        for (const row of data.data as MarksRow[]) {
          nextInputs[row.recruit_id] = row.marks === null ? "" : String(row.marks);
        }
        setInputs(nextInputs);
      } else {
        toast.error(data.error || "Could not load recruits");
        setRows([]);
      }
    } catch {
      toast.error("Could not load recruits");
      setRows([]);
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

    setSavingId(recruitId);
    try {
      const res = await fetch("/api/admin/recruitment/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruit_id: recruitId, sub_domain: domain, marks }),
      });
      const data = await res.json();
      if (res.ok && data.saved) {
        toast.success("Marks saved");
        setRows((prev) =>
          prev.map((r) => (r.recruit_id === recruitId ? { ...r, marks } : r))
        );
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
    const filtered = term
      ? rows.filter(
          (row) =>
            row.name.toLowerCase().includes(term) || row.reg_no.toLowerCase().includes(term)
        )
      : rows;

    if (!sort) return filtered;

    const sorted = [...filtered].sort((a, b) => compareBy(a[sort.key], b[sort.key], sort.direction));
    return sorted;
  }, [rows, search, sort]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-red" />
          Marks Entry
        </h1>
        <p className="mt-2 text-gray-400 text-sm max-w-xl">
          Enter written-exam marks per recruit. Attendance is shown for reference only — marks
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or reg no..."
          className="w-full border-0 bg-white/5 py-2 pl-9 pr-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
        />
      </div>

      <div
        className="relative isolate bg-white/[0.03] backdrop-blur-xl before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-white/10"
        style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
      >
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No recruits selected {subDomainLabel(domain)}.
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No recruits match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                  <SortableTh label="Name" sortKey="name" sort={sort} onSort={onSort} />
                  <SortableTh label="Reg No" sortKey="reg_no" sort={sort} onSort={onSort} />
                  <SortableTh label="Marks" sortKey="marks" sort={sort} onSort={onSort} />
                  <th className="px-5 py-3 text-right">Save</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const dirty = inputs[row.recruit_id] !== (row.marks === null ? "" : String(row.marks));
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
                            <p className="mt-1 text-[10px] text-gray-500">
                              by {row.evaluator_username}
                            </p>
                          )}
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
                        <DetailRow colSpan={4}>
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
