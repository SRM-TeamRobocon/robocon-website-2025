"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ListChecks, Check, X, Search, MessageCircle } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

import { RECRUIT_SUBDOMAINS, subDomainLabel, subDomainSubsystem, type RecruitSubDomain } from "@/lib/recruit-domains";
import { SortableTh, compareBy, nextSortState, type SortState } from "@/components/recruit/SortableTh";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { ExpandToggleCell, DetailRow, DetailField } from "@/components/recruit/ExpandableRow";
import Select from "@/components/ui/select";

type ExamDomain = RecruitSubDomain;

const STATUS_OPTIONS = ["all", "pending", "shortlisted", "not_shortlisted"] as const;

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
    department: string;
    course: string;
    portfolio_url: string | null;
    phone: string | null;
  };
}

type ShortlistSortKey = "name" | "reg_no" | "domain" | "status";

function sortValueFor(row: ShortlistRow, key: ShortlistSortKey): string | number | null {
  switch (key) {
    case "name":
      return row.recruit.name;
    case "reg_no":
      return row.recruit.reg_no;
    case "domain":
      return row.sub_domain;
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
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}>
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
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/20 text-emerald-400 ring-1 ring-inset ring-emerald-500/40">
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
      className="h-4 w-4 rounded border-0 bg-white/10 text-blue-500 ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition"
        >
          <Check className="w-3.5 h-3.5" /> Shortlist
        </button>
        <button
          onClick={() => onDecide(row.id, "not_shortlisted", reason)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition"
        >
          <X className="w-3.5 h-3.5" /> Reject
        </button>
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-48 rounded-lg border-0 bg-white/5 py-1 px-2.5 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function ExamDomainsTab() {
  const [domain, setDomain] = useState<ExamDomain | "all">("all");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [rows, setRows] = useState<ShortlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [callBusyId, setCallBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<ShortlistSortKey>>(null);
  const [interviewDates, setInterviewDates] = useState<Record<string, string>>({});
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
    const filtered = q
      ? rows.filter(
          (row) =>
            row.recruit.name.toLowerCase().includes(q) || row.recruit.reg_no.toLowerCase().includes(q)
        )
      : rows;

    if (!sort) return filtered;
    return [...filtered].sort((a, b) => compareBy(sortValueFor(a, sort.key), sortValueFor(b, sort.key), sort.direction));
  }, [rows, search, sort]);

  const handleSort = (key: ShortlistSortKey) => setSort((prev) => nextSortState(prev, key));

  const sendWhatsApp = (row: ShortlistRow) => {
    const message = `Congratulations! You've cleared the SRM Team Robocon shortlist for ${subDomainLabel(
      row.sub_domain
    )}. Your interview is scheduled on: ${interviewDates[row.id] ?? ""}.`;
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
        toast.error("Already marked as called — refreshing");
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
              ...RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: `${d.subsystem} — ${d.label}` })),
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or reg no..."
            className="h-10 rounded-lg border-0 bg-white/5 pl-8 pr-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
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
                  <SortableTh label="Domain" sortKey="domain" sort={sort} onSort={handleSort} />
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
                        <td className="px-5 py-3 text-gray-300">
                          {subDomainLabel(row.sub_domain)}
                          <span className="ml-1.5 text-xs text-gray-500">{subDomainSubsystem(row.sub_domain)}</span>
                        </td>
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
                        <DetailRow colSpan={6}>
                          <DetailField label="Marks" value={row.marks ?? "—"} />
                          <DetailField
                            label="Method"
                            value={<span className="capitalize">{row.method.replace("_", " ")}</span>}
                          />
                          <DetailField label="Phone" value={row.recruit.phone || "—"} />
                          <DetailField
                            label="WhatsApp"
                            value={
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={interviewDates[row.id] ?? ""}
                                  onChange={(e) =>
                                    setInterviewDates((prev) => ({ ...prev, [row.id]: e.target.value }))
                                  }
                                  placeholder="Interview date/time"
                                  className="w-36 rounded-lg border-0 bg-white/5 py-1 px-2.5 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => sendWhatsApp(row)}
                                  disabled={!isShortlisted}
                                  title={isShortlisted ? "Send WhatsApp message" : "Only available for shortlisted recruits"}
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full ring-1 ring-inset transition shrink-0 ${
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
