"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { canDeleteSplit, collectorKey, formatRupees, isSplitOverdue, paymentUri, type SplitActor, type SplitAction, type SplitShare, type TeamSplit } from "@/lib/team-splits";
import { splitRequest } from "@/lib/team-splits-client";

const statusText = { unpaid: "Payment due", reported: "Awaiting confirmation", confirmed: "Confirmed" };
type PaymentMethod = "upi" | "cash" | "bank";
type ActionInput = { action: "report" | "record"; memberId: string; method: PaymentMethod; reference: string; paymentNote: string } | { action: "confirm"; memberId: string } | { action: "reject" | "reopen"; memberId: string; note: string } | { action: "cancel" | "remind" };

function PaymentPanel({ split, share, busy, onReport }: { split: TeamSplit; share: SplitShare; busy: boolean; onReport: (method: PaymentMethod, reference: string, paymentNote: string) => Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [qrError, setQrError] = useState("");
  const [copied, setCopied] = useState("");
  const uri = paymentUri(split, share);
  useEffect(() => {
    let active = true;
    import("qrcode").then(qr => {
      if (active && canvas.current) return qr.toCanvas(canvas.current, uri, { width: 240, margin: 3, errorCorrectionLevel: "M" });
    }).catch(() => { if (active) setQrError("QR unavailable. Use the UPI button or pay to the UPI ID below."); });
    return () => { active = false; };
  }, [uri, method]);
  return <section className="space-y-4 border border-red/40 bg-red/5 p-5">
    <h2 className="text-xl font-bold text-white">Your share: {formatRupees(share.amountPaise)}</h2>
    <p className="text-sm text-gray-300">Collector: {split.collector_name || split.creator_name}. {method === "upi" ? <>Pay at <strong className="break-all text-white">{split.upi_id}</strong> and check the recipient name in your app.</> : method === "cash" ? "Hand cash to the collector and record when you did so." : "Transfer to the collector's bank account and record the transaction reference."}</p>
    {share.reportedAt && <p className="border border-amber-500/30 p-3 text-sm text-amber-200">A previous payment was reported. Check its status with the collector and correct the details below. Do not pay again unless that payment failed or was refunded.</p>}
    {method === "upi" && !share.reportedAt && <div className="flex flex-wrap items-center gap-5">
      <canvas ref={canvas} role="img" aria-label={`UPI QR: pay ${formatRupees(share.amountPaise)} to ${split.upi_id}`} className="max-w-full" />
      <div className="space-y-3">
        <a href={uri} className="inline-block border border-red bg-red px-5 py-3 text-sm font-bold text-white">Pay with UPI</a>
        <p className="max-w-xs text-xs text-gray-400">Opens a compatible UPI app. You can also scan this QR from another device. Returning here does not confirm payment.</p>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(split.upi_id); setCopied("UPI ID copied"); } catch { setCopied("Copy the UPI ID displayed above."); } }} className="text-xs text-gray-300 underline">Copy UPI ID</button>
        <p aria-live="polite" className="text-xs text-gray-400">{copied}</p>
      </div>
    </div>}
    {qrError && <p role="alert" className="text-sm text-red-300">{qrError}</p>}
    {share.note && <p className="border border-amber-500/30 p-3 text-sm text-amber-200">Creator’s review: {share.note}</p>}
    <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void onReport(method, String(data.get("reference") || ""), String(data.get("paymentNote") || "")); }} className="space-y-3 border-t border-white/10 pt-4">
      <label className="block max-w-md text-sm text-gray-300">How did you pay?<select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className="mt-1 w-full border border-white/20 bg-black px-3 py-2 text-white"><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank transfer</option></select></label>
      {method !== "cash" && <label className="block text-sm text-gray-300">{share.reportedAt ? "Corrected transaction reference / UTR" : "Transaction reference / UTR"}<input name="reference" required minLength={6} maxLength={40} pattern="[a-zA-Z0-9-]+" autoComplete="off" placeholder="Reference from your successful payment" className="mt-1 block w-full max-w-md border border-white/20 bg-black px-3 py-2 text-white focus:border-red" /></label>}
      <label className="block text-sm text-gray-300">{method === "cash" ? "When and where did you hand over cash?" : "Note (optional)"}<input name="paymentNote" required={method === "cash"} maxLength={300} placeholder={method === "cash" ? "Cash given at workshop" : "Optional payment detail"} className="mt-1 block w-full border border-white/20 bg-black px-3 py-2 text-white focus:border-red" /></label>
      <label className="flex items-start gap-2 text-xs text-gray-400"><input type="checkbox" required className="mt-0.5 accent-red" />I completed this payment. The collector still needs to confirm receipt.</label>
      <button disabled={busy} className="border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-red disabled:opacity-40">{busy ? "Submitting…" : share.reportedAt ? "Submit corrected payment" : "Report payment"}</button>
    </form>
  </section>;
}

function RecordPayment({ share, busy, onRecord }: { share: SplitShare; busy: boolean; onRecord: (method: PaymentMethod, reference: string, paymentNote: string) => Promise<void> }) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  return <details className="mt-3 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs text-gray-300">Record payment received offline</summary>
    <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void onRecord(method, String(data.get("reference") || ""), String(data.get("paymentNote") || "")); }} className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-gray-300">Method<select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className="mt-1 w-full border border-white/20 bg-black px-3 py-2 text-white"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option></select></label>
      {method !== "cash" && <label className="text-xs text-gray-300">Transaction reference<input name="reference" required minLength={6} maxLength={40} pattern="[a-zA-Z0-9-]+" className="mt-1 w-full border border-white/20 bg-black px-3 py-2 text-white" /></label>}
      <label className="text-xs text-gray-300 sm:col-span-2">{method === "cash" ? "When and where was cash received?" : "Note (optional)"}<input name="paymentNote" required={method === "cash"} maxLength={300} className="mt-1 w-full border border-white/20 bg-black px-3 py-2 text-white" /></label>
      <button disabled={busy} className="border border-emerald-500/50 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-40 sm:col-span-2">Confirm {formatRupees(share.amountPaise)} received</button>
    </form>
  </details>;
}

function ReviewShare({ share, busy, onAction }: { share: SplitShare; busy: boolean; onAction: (action: ActionInput) => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
  return <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
    <label className="flex items-start gap-2 text-xs text-gray-300"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-0.5 accent-red" />I verified this full payment in my bank records or received the cash.</label>
    <button disabled={busy || !checked} onClick={() => void onAction({ action: "confirm", memberId: share.memberId })} className="border border-emerald-500/40 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-40">Confirm receipt</button>
    <label className="block text-xs text-gray-400">If receipt cannot be confirmed, explain why<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={2} className="mt-1 block w-full border border-white/20 bg-black px-3 py-2 text-sm text-white" /></label>
    <button disabled={busy || !note.trim()} onClick={() => void onAction({ action: "reject", memberId: share.memberId, note })} className="border border-white/15 px-3 py-2 text-xs text-gray-300 disabled:opacity-40">Return for correction</button>
  </div>;
}

function CorrectPayment({ share, busy, onReopen }: { share: SplitShare; busy: boolean; onReopen: (note: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  return <details className="mt-3 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs text-amber-200">Correct confirmed payment</summary><div className="mt-3 space-y-2"><label className="block text-xs text-gray-300">Reason for correction<input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="Refunded, wrong amount, or mistaken confirmation" className="mt-1 w-full border border-white/20 bg-black px-3 py-2 text-white" /></label><button disabled={busy || !reason.trim()} onClick={() => void onReopen(reason)} className="border border-amber-500/40 px-3 py-2 text-xs text-amber-200 disabled:opacity-40">Reopen {formatRupees(share.amountPaise)}</button></div></details>;
}

export default function SplitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [split, setSplit] = useState<TeamSplit | null>(null);
  const [actor, setActor] = useState<SplitActor | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await splitRequest<{ data: TeamSplit; actor: SplitActor }>(`/api/member/splits/${id}`, { signal });
      setSplit(result.data); setActor(result.actor);
    } catch (err) { if (!signal?.aborted) setError(err instanceof Error ? err.message : "Could not load split."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [id]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); }); return () => controller.abort(); }, [load]);
  async function act(action: ActionInput) {
    if (!split || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await splitRequest<{ data: TeamSplit }>(`/api/member/splits/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...action, version: split.version } satisfies SplitAction),
      });
      setSplit(result.data);
      setNotice(action.action === "report" ? "Payment reported. Waiting for the collector to confirm receipt." : action.action === "remind" ? "Dashboard reminders sent to unpaid members." : "Split updated.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update split."); }
    finally { setBusy(false); }
  }
  async function deleteSplit() {
    if (!split || busy || !window.confirm("Delete this unused split? This cannot be undone.")) return;
    setBusy(true); setError("");
    try {
      await splitRequest(`/api/member/splits/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: split.version }) });
      router.push("/dashboard/splits");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete split."); setBusy(false); }
  }
  const owner = !!split && actor?.key === split.creator_key;
  const collector = !!split && actor?.key === collectorKey(split);
  const mine = split?.shares.find(s => s.memberId === actor?.memberId);
  const covered = split?.shares.filter(s => s.status === "confirmed").reduce((sum, s) => sum + s.amountPaise, 0) ?? 0;
  const received = split?.shares.filter(s => s.status === "confirmed" && s.method !== "self").reduce((sum, s) => sum + s.amountPaise, 0) ?? 0;
  return <div className="max-w-4xl space-y-6">
    <div className="flex items-center justify-between gap-3"><Link href="/dashboard/splits" className="text-sm text-gray-400 hover:text-white">← Team Splits</Link><button disabled={loading || busy} onClick={() => { setLoading(true); setError(""); void load(); }} className="border border-white/15 px-3 py-2 text-xs text-gray-300 disabled:opacity-40">Refresh status</button></div>
    {error && <p role="alert" className="border border-red/40 p-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {loading ? <p role="status" className="text-gray-400">Loading split…</p> : split && <>
      <header className="border-l-2 border-red pl-5"><h1 className="break-words text-3xl font-bold text-white">{split.title}</h1><p className="mt-2 text-sm text-gray-400">Created by {split.creator_name} · collected by {split.collector_name || split.creator_name} · {new Date(split.created_at).toLocaleDateString("en-IN")}</p>{split.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-300">{split.description}</p>}</header>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {split.due_date && <span className={split.status === "open" && covered < split.total_paise && isSplitOverdue(split.due_date) ? "text-amber-200" : "text-gray-400"}>Due {split.due_date}{split.status === "open" && covered < split.total_paise && isSplitOverdue(split.due_date) ? " ? Overdue" : ""}</span>}
        {(owner || collector) && <a href={`/api/member/splits/${split.id}?format=csv`} className="border border-white/20 px-3 py-2 text-gray-300">Export CSV</a>}
        {owner && split.status === "open" && canDeleteSplit(split, actor!) && <Link href={`/dashboard/splits/${split.id}/edit`} className="border border-white/20 px-3 py-2 text-gray-300">Edit split</Link>}
        {collector && split.status === "open" && split.shares.some(s => s.status === "unpaid") && <button disabled={busy} onClick={() => void act({ action: "remind" })} className="border border-white/20 px-3 py-2 text-gray-300 disabled:opacity-40">Remind unpaid members</button>}
      </div>
      <p className="text-sm text-gray-400">{split.shares.filter(s => s.status === "confirmed").length} of {split.shares.length} members settled</p>
      <section className="space-y-4 border border-white/15 bg-white/[0.03] p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-gray-400">Expense progress</p><p className="mt-1 text-2xl text-white">{formatRupees(covered)} <span className="text-base text-gray-400">/ {formatRupees(split.total_paise)} covered</span></p></div><p className="text-sm text-gray-300">{formatRupees(received)} received from payments</p></div><div role="progressbar" aria-label="Expense covered" aria-valuemin={0} aria-valuemax={split.total_paise} aria-valuenow={covered} className="h-3 w-full bg-white/10"><div className="h-full bg-emerald-400 transition-[width]" style={{ width: `${Math.min(100, covered / split.total_paise * 100)}%` }} /></div><p className="text-sm text-gray-400">{formatRupees(split.total_paise - covered)} still due</p></section>
      {split.status === "cancelled" ? <p className="border border-white/20 p-4 text-gray-300">This request was cancelled. Do not make a payment. Contact the collector if you already paid.</p> : covered === split.total_paise ? <p className="border border-emerald-500/30 p-4 text-emerald-300">Every share has been covered.</p> : mine?.status === "unpaid" ? <PaymentPanel split={split} share={mine} busy={busy} onReport={(method, reference, paymentNote) => act({ action: "report", memberId: mine.memberId, method, reference, paymentNote })} /> : mine && <p className="border border-white/15 p-4 text-gray-300">{mine.method === "self" ? "Your share is covered as the collector." : statusText[mine.status]}{mine.status === "reported" ? " Do not pay again while waiting for confirmation." : ""}</p>}
      {collector && <p className="text-sm text-gray-400">Collecting at <span className="break-all text-white">{split.upi_id}</span> ({split.payee_name}). Verify payments before confirming them.</p>}
      <section className="space-y-3"><h2 className="text-xl font-bold text-white">Participants</h2>{split.shares.map(share => <article key={share.memberId} className="border border-white/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-white">{share.name}{share.memberId === actor?.memberId ? " (you)" : ""}</h3><p className="mt-1 text-xs text-gray-400">{split.status === "cancelled" ? "Cancelled" : statusText[share.status]}</p></div><span className="text-white">{formatRupees(share.amountPaise)}</span></div>
        {share.method && <p className="mt-2 text-xs text-gray-300">Method: {share.method === "self" ? "Collector share" : share.method.toUpperCase()}</p>}
        {share.reference && <p className="mt-2 break-all text-xs text-gray-300">Reported reference: {share.reference}</p>}
        {share.paymentNote && <p className="mt-1 break-words text-xs text-gray-400">Payment note: {share.paymentNote}</p>}
        {share.confirmedAt && <p className="mt-1 text-xs text-gray-500">Confirmed {new Date(share.confirmedAt).toLocaleString("en-IN")}</p>}
        {collector && share.note && <p className="mt-2 text-xs text-amber-200">Review note: {share.note}</p>}
        {collector && share.status === "unpaid" && split.status === "open" && <RecordPayment share={share} busy={busy} onRecord={(method, reference, paymentNote) => act({ action: "record", memberId: share.memberId, method, reference, paymentNote })} />}
        {collector && share.status === "reported" && split.status === "open" && <ReviewShare key={`${share.memberId}:${split.version}`} share={share} busy={busy} onAction={act} />}
        {collector && share.status === "confirmed" && share.method !== "self" && split.status === "open" && <CorrectPayment share={share} busy={busy} onReopen={note => act({ action: "reopen", memberId: share.memberId, note })} />}
      </article>)}</section>
      <details className="border border-white/15 p-4"><summary className="cursor-pointer text-sm text-gray-300">Payment activity</summary><ul className="mt-3 space-y-2 text-xs text-gray-400">{split.events.slice(-50).reverse().map((event, index) => <li key={`${event.at}:${index}`} className="break-words">{new Date(event.at).toLocaleString("en-IN")} · {({ created: "Request created", edit: "Request edited", remind: "Dashboard reminders sent", report: "Payment reported", record: "Payment recorded by collector", confirm: "Receipt confirmed by collector", reject: "Returned for correction", reopen: "Confirmed payment reopened", cancel: "Request cancelled" } as Record<string, string>)[event.action]}{event.memberId ? ` · ${split.shares.find(s => s.memberId === event.memberId)?.name || "Member"}` : ""}{event.reference ? ` · ${event.reference}` : ""}{event.note ? ` · ${event.note}` : ""}</li>)}</ul></details>
      {owner && canDeleteSplit(split, actor!) && <div className="flex flex-wrap gap-3 border-t border-white/15 pt-4">{split.status === "open" && <button disabled={busy} onClick={() => { if (window.confirm("Cancel this request? First check that nobody has paid, including payments not reported here.")) void act({ action: "cancel" }); }} className="border border-white/20 px-4 py-2 text-sm text-gray-300 disabled:opacity-40">Cancel request</button>}<button disabled={busy} onClick={() => void deleteSplit()} className="border border-red/40 px-4 py-2 text-sm text-red-300 disabled:opacity-40">Delete unused split</button></div>}
    </>}
  </div>;
}
