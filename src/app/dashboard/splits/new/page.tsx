"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { allocateShares, createSplitSchema, formatRupees, type SplitMember } from "@/lib/team-splits";
import { splitRequest } from "@/lib/team-splits-client";

const inputClass = "mt-1 w-full border border-white/20 bg-black px-3 py-2 text-white outline-none focus:border-red disabled:opacity-50";
export default function NewSplitPage() {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const [members, setMembers] = useState<SplitMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError("");
    splitRequest<{ data: SplitMember[] }>("/api/member/splits/members", { signal: controller.signal })
      .then(r => setMembers(r.data)).catch(err => { if (!controller.signal.aborted) setLoadError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const filtered = members.filter(m => `${m.name} ${m.domain}`.toLowerCase().includes(search.toLowerCase()));
  const participants = Object.entries(selected).map(([memberId, amount]) => ({ memberId, amount }));
  let preview = "Select members and enter an amount.";
  try {
    const shares = allocateShares({ id: "", title: "", description: "", upiId: "", payeeName: "", total, mode, participants }, members, null);
    const min = Math.min(...shares.map(s => s.amountPaise)); const max = Math.max(...shares.map(s => s.amountPaise));
    if (shares.length) preview = mode === "equal" ? `${shares.length} members · ${formatRupees(min)}${max !== min ? `–${formatRupees(max)}` : ""} each` : `${shares.length} members · custom shares match the total`;
  } catch (err) { if (total && participants.length) preview = err instanceof Error ? err.message : preview; }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    requestId.current ??= crypto.randomUUID();
    const parsed = createSplitSchema.safeParse({ id: requestId.current, title: form.get("title"), description: form.get("description"), upiId: form.get("upiId"), payeeName: form.get("payeeName"), total, mode, participants });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check the form."); return; }
    try {
      allocateShares(parsed.data, members, null);
      setBusy(true);
      const result = await splitRequest<{ id: string }>("/api/member/splits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      router.push(`/dashboard/splits/${result.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create split."); setBusy(false); }
  }
  return <div className="max-w-3xl space-y-6">
    <Link href="/dashboard/splits" className="text-sm text-gray-400 hover:text-white">← Team Splits</Link>
    <div><h1 className="text-3xl font-bold text-white">Create split</h1><p className="mt-2 text-sm text-gray-400">Collect directly into your UPI account. Exclude your own share from the total.</p></div>
    <form onSubmit={submit} className="space-y-6">
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
        <label className="block text-sm text-gray-300">Expense title<input name="title" required maxLength={100} placeholder="Components for the robot" className={inputClass} /></label>
        <label className="block text-sm text-gray-300">Description (optional)<textarea name="description" maxLength={500} rows={2} className={inputClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-gray-300">Your UPI ID<input name="upiId" required maxLength={193} placeholder="yourname@bank" autoCapitalize="none" spellCheck={false} className={inputClass} /></label>
          <label className="block text-sm text-gray-300">Recipient name<input name="payeeName" required minLength={2} maxLength={100} placeholder="Name shown by your bank" className={inputClass} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-gray-300">Total to collect (₹)<input required inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="1200.00" className={inputClass} /></label>
          <label className="block text-sm text-gray-300">Split method<select value={mode} onChange={e => setMode(e.target.value as "equal" | "custom")} className={inputClass}><option value="equal">Equal shares</option><option value="custom">Custom amounts</option></select></label>
        </div>
        <section className="border border-white/15 p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-white">Participants ({participants.length}/100)</h2><button type="button" onClick={() => setSelected({})} className="text-xs text-gray-400 hover:text-white">Clear</button></div>
          <label className="mt-3 block text-sm text-gray-300">Find members<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or domain" className={inputClass} /></label>
          {loading ? <p role="status" className="py-4 text-sm text-gray-400">Loading members…</p> : loadError ? <div role="alert" className="py-4 text-sm text-red-300">{loadError}<button type="button" onClick={() => setAttempt(a => a + 1)} className="ml-3 underline">Retry</button></div> : <>
            <button type="button" onClick={() => setSelected(current => { const next = { ...current }; for (const member of filtered) { if (Object.keys(next).length >= 100) break; next[member.id] ??= ""; } return next; })} className="my-3 text-xs text-gray-300 underline">Select matching members (up to 100)</button>
            <div className="max-h-80 space-y-1 overflow-y-auto">{filtered.length === 0 ? <p className="text-sm text-gray-400">No members found.</p> : filtered.map(member => <div key={member.id} className="flex items-center gap-3 border-b border-white/5 py-2">
              <label className="flex min-w-0 flex-1 items-center gap-3 text-sm text-white"><input type="checkbox" checked={member.id in selected} disabled={!(member.id in selected) && participants.length >= 100} onChange={e => setSelected(current => { const next = { ...current }; if (e.target.checked) next[member.id] = ""; else delete next[member.id]; return next; })} className="accent-red" /><span className="break-words">{member.name}<span className="ml-2 text-xs text-gray-500">{member.domain}</span></span></label>
              {mode === "custom" && member.id in selected && <input aria-label={`Amount for ${member.name} in rupees`} inputMode="decimal" placeholder="₹ amount" required value={selected[member.id]} onChange={e => setSelected(current => ({ ...current, [member.id]: e.target.value }))} className="w-28 border border-white/20 bg-black px-2 py-2 text-sm text-white" />}
            </div>)}</div>
          </>}
          <p aria-live="polite" className="mt-3 text-sm text-gray-300">{preview}</p>
          {mode === "equal" && <p className="mt-1 text-xs text-gray-500">Any remaining paise are distributed across the selected members.</p>}
        </section>
        <label className="flex items-start gap-3 text-sm text-gray-300"><input type="checkbox" required className="mt-1 accent-red" /><span>This is my UPI account. I will check my bank records before confirming payments. Amounts, participants, and the UPI ID cannot be changed after creation.</span></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={busy || loading || !!loadError || !participants.length} className="border border-red bg-red px-6 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? "Creating…" : "Create payment request"}</button>
    </form>
  </div>;
}
