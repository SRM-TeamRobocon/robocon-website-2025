"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { allocateShares, createSplitSchema, formatRupees, parseRupees, canDeleteSplit, type SplitActor, type TeamSplit, type SplitMember } from "@/lib/team-splits";
import { splitRequest } from "@/lib/team-splits-client";

const inputClass = "mt-1 w-full border border-white/20 bg-black px-3 py-2 text-white outline-none focus:border-red disabled:opacity-50";
export default function SplitForm({ editId }: { editId?: string }) {
  const [initial, setInitial] = useState<TeamSplit | null>(null);
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const [members, setMembers] = useState<SplitMember[]>([]);
  const [actorMemberId, setActorMemberId] = useState<string | null>(null);
  const [collectorMemberId, setCollectorMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      splitRequest<{ data: SplitMember[]; actorMemberId: string | null }>("/api/member/splits/members", { signal: controller.signal }),
      editId ? splitRequest<{ data: TeamSplit; actor: SplitActor }>(`/api/member/splits/${editId}`, { signal: controller.signal }) : Promise.resolve(null),
    ]).then(([r, existing]) => {
      setMembers(r.data); setActorMemberId(r.actorMemberId);
      if (existing) {
        if (!canDeleteSplit(existing.data, existing.actor) || existing.data.status !== "open") throw new Error("This split can no longer be edited.");
        setInitial(existing.data); setCollectorMemberId(existing.data.collector_member_id);
        setTotal((existing.data.total_paise / 100).toFixed(2)); setMode("custom");
        setSelected(Object.fromEntries(existing.data.shares.map(s => [s.memberId, (s.amountPaise / 100).toFixed(2)])));
      }
    }).catch(err => { if (!controller.signal.aborted) setLoadError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, editId]);
  const domains = Array.from(new Set(members.map(m => m.domain).filter(Boolean))).sort();
  const filtered = members.filter(m => (!domain || m.domain === domain) && `${m.name} ${m.domain}`.toLowerCase().includes(search.toLowerCase()));
  const participants = Object.entries(selected).map(([memberId, amount]) => ({ memberId, amount }));
  let preview = "Select members and enter an amount.";
  try {
    const shares = allocateShares({ id: "", title: "", description: "", upiId: "", payeeName: "", collectorMemberId, total, mode, participants }, members, null);
    const min = Math.min(...shares.map(s => s.amountPaise)); const max = Math.max(...shares.map(s => s.amountPaise));
    if (shares.length) {
      const covered = shares.find(s => s.memberId === (collectorMemberId ?? actorMemberId))?.amountPaise ?? 0;
      preview = `${mode === "equal" ? `${shares.length} members · ${formatRupees(min)}${max !== min ? `–${formatRupees(max)}` : ""} each` : `${shares.length} members · custom shares match the total`} · ${formatRupees(parseRupees(total) - covered)} to collect`;
    }
  } catch (err) { if (total && participants.length) preview = err instanceof Error ? err.message : preview; }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    requestId.current ??= editId ?? crypto.randomUUID();
    const parsed = createSplitSchema.safeParse({ id: requestId.current, title: form.get("title"), description: form.get("description"), upiId: form.get("upiId"), payeeName: form.get("payeeName"), collectorMemberId, dueDate: form.get("dueDate") || null, total, mode, participants });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check the form."); return; }
    try {
      allocateShares(parsed.data, members, null);
      setBusy(true);
      const result = await splitRequest<{ id: string }>(editId ? `/api/member/splits/${editId}` : "/api/member/splits", { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editId ? { ...parsed.data, version: initial?.version } : parsed.data) });
      router.push(`/dashboard/splits/${result.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create split."); setBusy(false); }
  }
  if (editId && loading) return <p role="status">Loading split?</p>;
  if (editId && loadError) return <p role="alert" className="text-red-300">{loadError}</p>;
  return <div className="max-w-3xl space-y-6">
    <Link href="/dashboard/splits" className="text-sm text-gray-400 hover:text-white">← Team Splits</Link>
    <div><h1 className="text-3xl font-bold text-white">{editId ? "Edit split" : "Create split"}</h1><p className="mt-2 text-sm text-gray-400">Choose who receives payments, then divide the full expense among the team.</p></div>
    <form onSubmit={submit} className="space-y-6">
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
        <label className="block text-sm text-gray-300">Expense title<input name="title" defaultValue={initial?.title} required maxLength={100} placeholder="Components for the robot" className={inputClass} /></label>
        <label className="block text-sm text-gray-300">Description (optional)<textarea name="description" defaultValue={initial?.description} maxLength={500} rows={2} className={inputClass} /></label>
        <label className="block text-sm text-gray-300">Due date (optional)<input type="date" name="dueDate" defaultValue={initial?.due_date ?? ""} className={inputClass} /></label>
        <section className="space-y-4 border-l-2 border-red bg-white/[0.03] p-5">
          <h2 className="text-lg font-bold text-white">Where payments go</h2>
          <label className="block text-sm text-gray-300">Collector<select value={collectorMemberId ?? ""} onChange={e => setCollectorMemberId(e.target.value || null)} className={inputClass}><option value="">Me ({actorMemberId ? members.find(m => m.id === actorMemberId)?.name ?? "creator" : "creator"})</option>{members.filter(m => m.id !== actorMemberId).map(m => <option key={m.id} value={m.id}>{m.name} — {m.domain}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm text-gray-300">Collector UPI ID<input name="upiId" defaultValue={initial?.upi_id} required maxLength={193} placeholder="name@bank" autoCapitalize="none" spellCheck={false} className={inputClass} /></label><label className="block text-sm text-gray-300">Name on UPI account<input name="payeeName" defaultValue={initial?.payee_name} required minLength={2} maxLength={100} placeholder="Bank account name" className={inputClass} /></label></div>
          <p className="text-xs text-gray-400">Confirm these details with the collector. Their own share, if included, is marked as covered without a transfer.</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-gray-300">Full expense (₹)<input required inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="1200.00" className={inputClass} /></label>
          <label className="block text-sm text-gray-300">Split method<select value={mode} onChange={e => setMode(e.target.value as "equal" | "custom")} className={inputClass}><option value="equal">Equal shares</option><option value="custom">Custom amounts</option></select></label>
        </div>
        <section className="border border-white/15 p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-white">Participants ({participants.length}/100)</h2><button type="button" onClick={() => setSelected({})} className="text-xs text-gray-400 hover:text-white">Clear</button></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="mt-3 block text-sm text-gray-300">Find members<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" className={inputClass} /></label><label className="mt-3 block text-sm text-gray-300">Domain<select value={domain} onChange={e => setDomain(e.target.value)} className={inputClass}><option value="">All domains</option>{domains.map(item => <option key={item} value={item}>{item}</option>)}</select></label></div>
          {actorMemberId && <button type="button" onClick={() => setSelected(current => ({ ...current, [actorMemberId]: current[actorMemberId] ?? "" }))} className="mt-3 text-xs text-white underline">Include my share</button>}
          {loading ? <p role="status" className="py-4 text-sm text-gray-400">Loading members…</p> : loadError ? <div role="alert" className="py-4 text-sm text-red-300">{loadError}<button type="button" onClick={() => { setLoading(true); setLoadError(""); setAttempt(a => a + 1); }} className="ml-3 underline">Retry</button></div> : <>
            <button type="button" onClick={() => setSelected(current => { const next = { ...current }; for (const member of filtered) { if (Object.keys(next).length >= 100) break; next[member.id] ??= ""; } return next; })} className="my-3 text-xs text-gray-300 underline">Select matching members (up to 100)</button>
            <div className="max-h-80 space-y-1 overflow-y-auto">{filtered.length === 0 ? <p className="text-sm text-gray-400">No members found.</p> : filtered.map(member => <div key={member.id} className="flex items-center gap-3 border-b border-white/5 py-2">
              <label className="flex min-w-0 flex-1 items-center gap-3 text-sm text-white"><input type="checkbox" checked={member.id in selected} disabled={!(member.id in selected) && participants.length >= 100} onChange={e => setSelected(current => { const next = { ...current }; if (e.target.checked) next[member.id] = ""; else delete next[member.id]; return next; })} className="accent-red" /><span className="break-words">{member.name}<span className="ml-2 text-xs text-gray-500">{member.domain}</span></span></label>
              {mode === "custom" && member.id in selected && <input aria-label={`Amount for ${member.name} in rupees`} inputMode="decimal" placeholder="₹ amount" required value={selected[member.id]} onChange={e => setSelected(current => ({ ...current, [member.id]: e.target.value }))} className="w-28 border border-white/20 bg-black px-2 py-2 text-sm text-white" />}
            </div>)}</div>
          </>}
          <p aria-live="polite" className="mt-3 text-sm text-gray-300">{preview}</p>
          {mode === "equal" && <p className="mt-1 text-xs text-gray-500">Any remaining paise are distributed across the selected members.</p>}
        </section>
        <label className="flex items-start gap-3 text-sm text-gray-300"><input type="checkbox" required className="mt-1 accent-red" /><span>I checked the collector and UPI details. The collector will verify payments before confirming them. Changes are allowed only before any payment is reported.</span></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={busy || loading || !!loadError || !participants.length} className="border border-red bg-red px-6 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? "Creating…" : "Create payment request"}</button>
    </form>
  </div>;
}
