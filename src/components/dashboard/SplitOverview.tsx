"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatRupees } from "@/lib/team-splits";
import { splitRequest } from "@/lib/team-splits-client";
type Totals = { owedPaise: number; collectingPaise: number; awaitingPaise: number; reviewCount: number; reminderCount: number };
export default function SplitOverview({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const [data, setData] = useState<Totals | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (compact && pathname !== "/dashboard") return;
    const controller = new AbortController();
    splitRequest<{ data: Totals }>("/api/member/splits/overview", { signal: controller.signal })
      .then(r => { setData(r.data); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [compact, pathname]);
  if (compact) return pathname === "/dashboard" && data && data.reminderCount > 0 ? <Link href="/dashboard/splits" className="mb-5 block border-l-2 border-amber-400 bg-amber-400/10 p-4 text-sm text-amber-100">Collectors sent reminders for {data.reminderCount} unpaid shares. View payments</Link> : null;
  if (error) return <p role="alert" className="text-sm text-red-300">Could not load overview. Refresh to retry.</p>;
  return <section aria-label="All open splits" className="grid gap-3 sm:grid-cols-3">{[["You owe", data?.owedPaise], ["You’re collecting", data?.collectingPaise], ["Awaiting confirmation", data?.awaitingPaise]].map(([label, amount]) => <div key={label} className="border border-white/15 bg-white/[0.03] p-5"><p className="text-sm text-gray-400">{label}</p><p className="mt-2 text-2xl text-white">{typeof amount === "number" ? formatRupees(amount) : "…"}</p></div>)}{data && <p className="text-xs text-gray-400 sm:col-span-3">All open splits · {data.reviewCount} payments need your review{data.reminderCount ? ` · ${data.reminderCount} reminders for your unpaid shares` : ""}</p>}</section>;
}
