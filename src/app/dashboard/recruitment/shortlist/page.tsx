"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ListChecks, Check, X, Search, MessageCircle } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

import { RECRUIT_SUBDOMAINS, subDomainLabel, subDomainFullLabel, subDomainSubsystem, type RecruitSubDomain } from "@/lib/recruit-domains";
import { SortableTh, compareBy, nextSortState, type SortState } from "@/components/recruit/SortableTh";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { phoneSearchTerm } from "@/lib/recruit-validation";
import { ExpandToggleCell, DetailRow, DetailField } from "@/components/recruit/ExpandableRow";
import { GENDERS } from "@/lib/gender";
import { RECRUIT_YEARS } from "@/lib/recruit-year";
import Select from "@/components/ui/select";

type ExamDomain = RecruitSubDomain;

const STATUS_OPTIONS = ["all", "pending", "shortlisted", "not_shortlisted"] as const;

const GENDER_OPTIONS = [
  { value: "all", label: "All Genders" },
  ...GENDERS.map((g) => ({ value: g.key, label: g.label })),
];

const YEAR_OPTIONS = [
  { value: "all", label: "All Years" },
  ...RECRUIT_YEARS.map((y) => ({ value: y.key as string, label: y.label })),
];

interface ShortlistRow {
  id: string;
  recruit_id: string;
  sub_domain: string;
  status: "pending" | "shortlisted" | "not_shortlisted";
  method: string;
  override_reason: string | null;
  overridden_by: string | null;
  overridden_at: string | null;
  computed_at: string | null;
  called_by: string | null;
  called_at: string | null;
  marks: number | null;
  recruit: {
    id: string;
    name: string;
    reg_no: string;
    year: string;
    gender: string | null;
    department: string;
    course: string;
    portfolio_url: string | null;
    phone: string | null;
  };
}

type ShortlistSortKey = "name" | "reg_no" | "year" | "domain" | "marks" | "status";

function sortValueFor(row: ShortlistRow, key: ShortlistSortKey): string | number | null {
  switch (key) {
    case "name":
      return row.recruit.name;
    case "reg_no":
      return row.recruit.reg_no;
    // Sorted numerically, not as the "1"/"2" strings the column stores, so the order stays
    // right if a third year is ever added (a plain string sort would put "10" before "2").
    case "year":
      return Number(row.recruit.year);
    case "domain":
      return row.sub_domain;
    // Null (nobody has marked them yet) sorts last in both directions - compareBy handles
    // that - so an unmarked recruit never masquerades as a zero at the top of the list.
    case "marks":
      return row.marks;
    case "status":
      return row.status;
    default:
      return null;
  }
}

function StatusBadge({ status }: { status: ShortlistRow["status"] }) {
  const styles =
    status === "shortlisted"
      ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
      : status === "not_shortlisted"
      ? "bg-red-500/15 text-red-400 ring-red-500/30"
      : "bg-amber-500/15 text-amber-400 ring-amber-500/30";
  const label =
    status === "shortlisted" ? "Shortlisted" : status === "not_shortlisted" ? "Not Shortlisted" : "Pending";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}>
      {label}
    </span>
  );
}

function CalledCheckbox({
  row,
  busy,
  onCall,
}: {
  row: ShortlistRow;
  busy: boolean;
  onCall: (id: string) => void;
}) {
  if (row.called_by) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center bg-emerald-500/20 text-emerald-400 ring-1 ring-inset ring-emerald-500/40">
          <Check className="w-3 h-3" />
        </span>
        <span className="text-xs text-gray-400 whitespace-nowrap">called by {row.called_by}</span>
      </div>
    );
  }

  return (
    <input
      type="checkbox"
      checked={false}
      disabled={busy}
      onChange={() => onCall(row.id)}
      aria-label="Mark as called"
      className="h-4 w-4 border-0 bg-white/10 text-blue-500 ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
    />
  );
}

function OverrideControls({
  row,
  busy,
  onDecide,
}: {
  row: ShortlistRow;
  busy: boolean;
  onDecide: (id: string, status: "shortlisted" | "not_shortlisted", reason: string) => void;
}) {
  const [reason, setReason] = useState(row.override_reason ?? "");

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex gap-2">
        <button
          onClick={() => onDecide(row.id, "shortlisted", reason)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition"
        >
          <Check className="w-3.5 h-3.5" /> Shortlist
        </button>
        <button
          onClick={() => onDecide(row.id, "not_shortlisted", reason)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition"
        >
          <X className="w-3.5 h-3.5" /> Reject
        </button>
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-48 border-0 bg-white/5 py-1 px-2.5 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function ExamDomainsTab() {
  const [domain, setDomain] = useState<ExamDomain | "all">("all");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [gender, setGender] = useState("all");
  const [year, setYear] = useState("all");
  const [rows, setRows] = useState<ShortlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [callBusyId, setCallBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<ShortlistSortKey>>(null);
  // ONE date for the whole page, not one per recruit. Interview day is walk-in with no time
  // slots (see the interview dashboard), so there is no per-recruit slot to record - everyone
  // shortlisted gets told the same day. Typing it once here also stops a lead retyping the
  // same string for every recruit they message.
  const [interviewDate, setInterviewDate] = useState("");
  // Per-recruit override, keyed by row id - for the recruit whose slot differs from the
  // shared date above (e.g. one domain's interviews run a different day). Empty for a row
  // means "use the shared date"; it does not mean "no date was set for this recruit".
  const [rowInterviewDates, setRowInterviewDates] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (domain !== "all") params.set("domain", domain);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/admin/recruitment/shortlist?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRows(data.data as ShortlistRow[]);
      } else {
        toast.error(data.error || "Could not load shortlist");
      }
    } catch {
      toast.error("Could not load shortlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, status]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Name/reg_no match the raw term; phone matches a digits-only copy of it, because
    // numbers are stored bare and a pasted "+91 98765 43210" has to normalize first.
    // phoneQ is null under 3 digits, so a stray digit in a name search matches no phones.
    // Searchable only - phone stays out of the rendered row.
    const phoneQ = phoneSearchTerm(search);
    const filtered = q
      ? rows.filter(
          (row) =>
            row.recruit.name.toLowerCase().includes(q) ||
            row.recruit.reg_no.toLowerCase().includes(q) ||
            (phoneQ !== null && (row.recruit.phone ?? "").includes(phoneQ))
        )
      : rows;

    // Gender is nullable on recruit_accounts, so a recruit with none on file matches neither
    // "Male" nor "Female" - "All Genders" is the option that keeps them in the list. Applied
    // client-side (unlike domain/status) because the column lives on the joined account.
    const byGender = gender === "all" ? filtered : filtered.filter((row) => row.recruit.gender === gender);

    // Same client-side treatment as gender: `year` lives on the joined account, not on
    // recruit_shortlist_status, so it can't ride the server-side domain/status query.
    const byYear = year === "all" ? byGender : byGender.filter((row) => row.recruit.year === year);

    if (!sort) return byYear;
    return [...byYear].sort((a, b) => compareBy(sortValueFor(a, sort.key), sortValueFor(b, sort.key), sort.direction));
  }, [rows, search, gender, year, sort]);

  const handleSort = (key: ShortlistSortKey) => setSort((prev) => nextSortState(prev, key));

  const sendWhatsApp = (row: ShortlistRow) => {
    // Row override wins when set; otherwise fall back to the shared date typed once at the
    // top. Covers the recruit whose slot differs (a domain interviewing on a different day)
    // without forcing every other message to be typed out individually.
    const rowOverride = (rowInterviewDates[row.id] ?? "").trim();
    const when = rowOverride || interviewDate.trim();
    // The date line REPLACES the "shared soon" placeholder rather than sitting beside it, so
    // the message never states a time and promises the time separately in the same breath.
    const schedule = when
      ? `Interview: ${when}`
      : "Further details regarding the interview schedule will be shared soon.";

    // Deliberately flush against column 0. A template literal keeps its source indentation,
    // so indenting these lines to match the surrounding code would put four leading spaces in
    // front of every line the recruit actually receives on WhatsApp.
    const message = `Congratulations! You've been shortlisted for the SRM Team Robocon interview for the ${subDomainFullLabel(
      row.sub_domain
    )}! 

Venue: SRM Team Robocon Lab, 1st Floor, SRM IST Canteen, near HiTech Block, Main Campus
Location: https://maps.app.goo.gl/y6auhbSeuUGh2o2N8

${schedule}

We're excited to meet you and see what you've got! 

All the best! 

- SRM Team Robocon`;

    const url = buildWhatsAppLink(row.recruit.phone ?? "", message);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast.error("No valid phone number on file for this recruit");
    }
  };

  const decide = async (id: string, newStatus: "shortlisted" | "not_shortlisted", reason: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/recruitment/shortlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, override_reason: reason || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Override saved");
        load();
      } else {
        toast.error(data.error || "Could not save override");
      }
    } catch {
      toast.error("Could not save override");
    } finally {
      setBusyId(null);
    }
  };

  const markCalled = async (id: string) => {
    setCallBusyId(id);
    try {
      const res = await fetch(`/api/admin/recruitment/shortlist/${id}/call`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === id ? { ...row, called_by: data.data.called_by, called_at: data.data.called_at } : row
          )
        );
      } else if (res.status === 409) {
        toast.error("Already marked as called, refreshing");
        load();
      } else {
        toast.error(data.error || "Could not mark as called");
      }
    } catch {
      toast.error("Could not mark as called");
    } finally {
      setCallBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Select
            accent="blue"
            value={domain}
            onChange={(v) => setDomain(v as ExamDomain | "all")}
            className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
            options={[
              { value: "all", label: "All Domains" },
              ...RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: `${d.subsystem}: ${d.label}` })),
            ]}
          />
        </div>
        <div className="w-44">
          <Select
            accent="blue"
            value={status}
            onChange={(v) => setStatus(v as (typeof STATUS_OPTIONS)[number])}
            className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
            options={STATUS_OPTIONS.map((s) => ({
              value: s,
              label: s === "all" ? "All Statuses" : s === "not_shortlisted" ? "Not Shortlisted" : s[0].toUpperCase() + s.slice(1),
            }))}
          />
        </div>
        <div className="w-40">
          <Select
            accent="blue"
            value={gender}
            onChange={setGender}
            className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
            options={GENDER_OPTIONS}
          />
        </div>
        <div className="w-36">
          <Select
            accent="blue"
            value={year}
            onChange={setYear}
            className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
            options={YEAR_OPTIONS}
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, reg no or phone..."
            className="h-10 border-0 bg-white/5 pl-8 pr-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <input
          type="text"
          value={interviewDate}
          onChange={(e) => setInterviewDate(e.target.value)}
          placeholder="Interview date/time (optional)"
          title="Default for every WhatsApp message sent from this page. A recruit's own row can override it. Leave blank and the message says the schedule follows separately."
          className="h-10 w-60 border-0 bg-white/5 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
        />
      </div>

      <div className="border border-white/10 bg-black">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No recruits match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                  <SortableTh label="Name" sortKey="name" sort={sort} onSort={handleSort} />
                  <SortableTh label="Reg No" sortKey="reg_no" sort={sort} onSort={handleSort} />
                  <SortableTh label="Year" sortKey="year" sort={sort} onSort={handleSort} />
                  <SortableTh label="Domain" sortKey="domain" sort={sort} onSort={handleSort} />
                  <SortableTh label="Marks" sortKey="marks" sort={sort} onSort={handleSort} />
                  <SortableTh label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                  <th className="px-5 py-3">Called</th>
                  <th className="px-5 py-3 text-right">Override</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isShortlisted = row.status === "shortlisted";
                  const expanded = expandedIds.has(row.id);
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-white/5 last:border-0">
                        <ExpandToggleCell expanded={expanded} onToggle={() => toggleExpanded(row.id)}>
                          {row.recruit.name}
                        </ExpandToggleCell>
                        <td className="px-5 py-3 text-gray-300">{row.recruit.reg_no}</td>
                        <td className="px-5 py-3 text-gray-300">{row.recruit.year || "-"}</td>
                        <td className="px-5 py-3 text-gray-300">
                          {subDomainLabel(row.sub_domain)}
                          <span className="ml-1.5 text-xs text-gray-500">{subDomainSubsystem(row.sub_domain)}</span>
                        </td>
                        {/* Null means nobody has marked them yet, which is NOT a zero, so the
                            dash keeps that distinction visible next to the status badge. */}
                        <td className="px-5 py-3 text-white font-semibold">{row.marks ?? "-"}</td>
                        <td className="px-5 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-3">
                          <CalledCheckbox row={row} busy={callBusyId === row.id} onCall={markCalled} />
                        </td>
                        <td className="px-5 py-3">
                          <OverrideControls row={row} busy={busyId === row.id} onDecide={decide} />
                        </td>
                      </tr>
                      {expanded && (
                        <DetailRow colSpan={8}>
                          <DetailField
                            label="Method"
                            value={<span className="capitalize">{row.method.replace("_", " ")}</span>}
                          />
                          <DetailField label="Phone" value={row.recruit.phone || "-"} />
                          <DetailField
                            label="WhatsApp"
                            value={
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={rowInterviewDates[row.id] ?? ""}
                                  onChange={(e) =>
                                    setRowInterviewDates((prev) => ({ ...prev, [row.id]: e.target.value }))
                                  }
                                  placeholder={interviewDate.trim() ? `Default: ${interviewDate.trim()}` : "Date/time for this recruit"}
                                  title="Overrides the shared date above for this recruit only. Leave blank to use the shared date."
                                  className="w-40 border-0 bg-white/5 py-1 px-2.5 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => sendWhatsApp(row)}
                                  disabled={!isShortlisted}
                                  title={isShortlisted ? "Send WhatsApp message" : "Only available for shortlisted recruits"}
                                  className={`inline-flex items-center justify-center w-8 h-8 ring-1 ring-inset transition shrink-0 ${
                                    isShortlisted
                                      ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30 hover:bg-emerald-500/25"
                                      : "bg-white/5 text-gray-600 ring-white/10 opacity-50 cursor-not-allowed"
                                  }`}
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                              </div>
                            }
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

export default function RecruitmentShortlistPage() {
  const ready = useRequireRole(["lead", "admin"]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <ListChecks className="w-7 h-7 text-red" />
          Shortlist
        </h1>
        <p className="mt-2 text-gray-400 text-sm max-w-xl">
          Review auto-computed shortlist status per domain, with manual override.
        </p>
      </div>

      <ExamDomainsTab />
    </div>
  );
}
