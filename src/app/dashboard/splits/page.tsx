"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import SplitOverview from "@/components/dashboard/SplitOverview";
import { formatRupees, isSplitOverdue } from "@/lib/team-splits";
import { splitRequest } from "@/lib/team-splits-client";

interface Summary {
  id: string; title: string; creatorName: string; collectorName: string; totalPaise: number; confirmedPaise: number;
  dueDate: string | null; settledCount: number; participantCount: number; reportedCount: number; status: string; createdAt: string;
  mine: { amountPaise: number; status: string; remindedAt?: string | null } | null;
}
const statuses: Record<string, string> = { unpaid: "Payment due", reported: "Awaiting collector confirmation", confirmed: "Share covered" };

export default function SplitsPage() {
  const [overviewVersion, setOverviewVersion] = useState(0);
  const [scope, setScope] = useState("owed");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Summary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await splitRequest<{ data: Summary[]; hasMore: boolean }>(`/api/member/splits?scope=${scope}&page=${page}`, { signal });
      setRows(result.data); setHasMore(result.hasMore);
    } catch (err) { if (!signal?.aborted) setError(err instanceof Error ? err.message : "Could not load splits."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [scope, page]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); }); return () => controller.abort(); }, [load]);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold text-white">Team Splits</h1><p className="mt-2 text-sm text-gray-400">Share expenses. Track UPI, cash, and bank payments.</p></div>
      <Link href="/dashboard/splits/new" className="inline-flex items-center gap-2 border border-red bg-red px-4 py-3 text-sm font-bold text-white hover:bg-red/80"><Plus size={16} /> Create split</Link>
    </div>
    <SplitOverview key={overviewVersion} />
    <div className="flex flex-wrap items-center gap-2">
      {[["owed", "My payments"], ["created", "Created by me"], ["collecting", "Collecting"]].map(([value, label]) => <button key={value} aria-pressed={scope === value} onClick={() => { if (scope !== value) { setLoading(true); setError(""); setScope(value); setPage(0); } }} className={`border px-4 py-2 text-sm ${scope === value ? "border-red bg-red/10 text-white" : "border-white/15 text-gray-400 hover:text-white"}`}>{label}</button>)}
      <button disabled={loading} onClick={() => { setOverviewVersion(v => v + 1); setLoading(true); setError(""); void load(); }} className="ml-auto flex items-center gap-2 border border-white/15 px-3 py-2 text-sm text-gray-300 disabled:opacity-50"><RefreshCw size={14} />Refresh</button>
    </div>
    {error ? <p role="alert" className="border border-red/40 p-4 text-sm text-red-300">{error}</p> : loading ? <p role="status" className="text-gray-400">Loading splits…</p> : rows.length === 0 ? <div className="border border-white/10 p-8 text-gray-400">{scope === "owed" ? "No payment requests on this page." : scope === "created" ? "No splits created on this page." : "No splits assigned to you for collection."}</div> : <div className="grid gap-4 md:grid-cols-2">{rows.map(row => <Link key={row.id} href={`/dashboard/splits/${row.id}`} className="group border border-white/15 bg-black p-5 transition hover:border-red/50">
      <div className="flex items-start justify-between gap-3"><h2 className="break-words text-lg font-bold text-white">{row.title}</h2><ArrowUpRight className="shrink-0 text-gray-500 group-hover:text-red" size={18} /></div>
      <p className="mt-1 text-xs text-gray-400">Created by {row.creatorName}</p>
      <p className="mt-1 text-xs text-gray-400">Collector: {row.collectorName}</p>
      {row.dueDate && <p className={`mt-3 text-xs ${row.status === "open" && row.confirmedPaise < row.totalPaise && isSplitOverdue(row.dueDate) ? "text-amber-200" : "text-gray-400"}`}>Due {row.dueDate}{row.status === "open" && row.confirmedPaise < row.totalPaise && isSplitOverdue(row.dueDate) ? " ? Overdue" : ""}</p>}
      {row.status === "open" && row.mine?.status === "unpaid" && row.mine.remindedAt && <p className="mt-2 text-xs text-amber-200">Collector reminder: {new Date(row.mine.remindedAt).toLocaleDateString("en-IN")}</p>}
      <p className="mt-2 text-xs text-gray-400">{row.settledCount} of {row.participantCount} settled</p>
      <p className="mt-5 text-2xl text-white">{formatRupees(scope === "owed" && row.mine ? row.mine.amountPaise : row.totalPaise)}</p>
      <p className="mt-2 text-sm text-gray-300">{row.status === "cancelled" ? "Cancelled" : row.confirmedPaise === row.totalPaise ? "Fully covered" : scope === "owed" && row.mine ? statuses[row.mine.status] : `${formatRupees(row.confirmedPaise)} / ${formatRupees(row.totalPaise)} covered · ${row.reportedCount} to review`}</p>
      <div role="progressbar" aria-label={`${row.title} expense covered`} aria-valuemin={0} aria-valuemax={row.totalPaise} aria-valuenow={row.confirmedPaise} className="mt-4 h-1.5 bg-white/10"><div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, row.confirmedPaise / row.totalPaise * 100)}%` }} /></div>
    </Link>)}</div>}
    <div className="flex items-center justify-between gap-3 text-sm text-gray-400">
      <button disabled={page === 0 || loading} onClick={() => { setLoading(true); setError(""); setPage(p => p - 1); }} className="border border-white/15 px-4 py-2 disabled:opacity-30">Previous</button><span>Page {page + 1}</span>
      <button disabled={!hasMore || loading} onClick={() => { setLoading(true); setError(""); setPage(p => p + 1); }} className="border border-white/15 px-4 py-2 disabled:opacity-30">Next</button>
    </div>
  </div>;
}
