"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatRupees, paymentUri, type SplitActor, type SplitAction, type SplitShare, type TeamSplit } from "@/lib/team-splits";
import { splitRequest } from "@/lib/team-splits-client";

const statusText = { unpaid: "Payment due", reported: "Awaiting creator confirmation", confirmed: "Confirmed by creator" };
type ActionInput = { action: "report"; memberId: string; reference: string } | { action: "confirm"; memberId: string } | { action: "reject"; memberId: string; note: string } | { action: "cancel" };

function PaymentPanel({ split, share, busy, onReport }: { split: TeamSplit; share: SplitShare; busy: boolean; onReport: (reference: string) => Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [qrError, setQrError] = useState("");
  const [copied, setCopied] = useState("");
  const uri = paymentUri(split, share);
  useEffect(() => {
    let active = true;
    import("qrcode").then(qr => {
      if (active && canvas.current) return qr.toCanvas(canvas.current, uri, { width: 240, margin: 3, errorCorrectionLevel: "M" });
    }).catch(() => { if (active) setQrError("QR unavailable. Use the UPI button or pay to the UPI ID below."); });
    return () => { active = false; };
  }, [uri]);
  return <section className="space-y-4 border border-red/40 bg-red/5 p-5">
    <h2 className="text-xl font-bold text-white">Your share: {formatRupees(share.amountPaise)}</h2>
    <p className="text-sm text-gray-300">Pay {split.payee_name} at <strong className="break-all text-white">{split.upi_id}</strong>. Check the recipient name in your UPI app before paying.</p>
    <div className="flex flex-wrap items-center gap-5">
      <canvas ref={canvas} role="img" aria-label={`UPI QR: pay ${formatRupees(share.amountPaise)} to ${split.upi_id}`} className="max-w-full" />
      <div className="space-y-3">
        <a href={uri} className="inline-block border border-red bg-red px-5 py-3 text-sm font-bold text-white">Pay with UPI</a>
        <p className="max-w-xs text-xs text-gray-400">Opens a compatible UPI app. You can also scan this QR from another device. Returning here does not confirm payment.</p>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(split.upi_id); setCopied("UPI ID copied"); } catch { setCopied("Copy the UPI ID displayed above."); } }} className="text-xs text-gray-300 underline">Copy UPI ID</button>
        <p aria-live="polite" className="text-xs text-gray-400">{copied}</p>
      </div>
    </div>
    {qrError && <p role="alert" className="text-sm text-red-300">{qrError}</p>}
    {share.note && <p className="border border-amber-500/30 p-3 text-sm text-amber-200">Creator’s review: {share.note}</p>}
    <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void onReport(String(data.get("reference") || "")); }} className="space-y-3 border-t border-white/10 pt-4">
      <label className="block text-sm text-gray-300">Transaction reference / UTR<input name="reference" required minLength={6} maxLength={40} pattern="[a-zA-Z0-9\-]+" autoComplete="off" placeholder="Reference from your successful UPI payment" className="mt-1 block w-full max-w-md border border-white/20 bg-black px-3 py-2 text-white focus:border-red" /></label>
      <label className="flex items-start gap-2 text-xs text-gray-400"><input type="checkbox" required className="mt-0.5 accent-red" />My UPI app shows this payment as successful. The creator still needs to confirm receipt.</label>
      <button disabled={busy} className="border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-red disabled:opacity-40">{busy ? "Submitting…" : "I paid — submit reference"}</button>
    </form>
  </section>;
}

function ReviewShare({ share, busy, onAction }: { share: SplitShare; busy: boolean; onAction: (action: ActionInput) => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
  return <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
    <label className="flex items-start gap-2 text-xs text-gray-300"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-0.5 accent-red" />I checked my bank records and received this member’s full share with this reference.</label>
    <button disabled={busy || !checked} onClick={() => void onAction({ action: "confirm", memberId: share.memberId })} className="border border-emerald-500/40 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-40">Confirm receipt</button>
    <label className="block text-xs text-gray-400">If receipt cannot be confirmed, explain why<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={2} className="mt-1 block w-full border border-white/20 bg-black px-3 py-2 text-sm text-white" /></label>
    <button disabled={busy || !note.trim()} onClick={() => void onAction({ action: "reject", memberId: share.memberId, note })} className="border border-white/15 px-3 py-2 text-xs text-gray-300 disabled:opacity-40">Return for correction</button>
  </div>;
}

export default function SplitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [split, setSplit] = useState<TeamSplit | null>(null);
  const [actor, setActor] = useState<SplitActor | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const result = await splitRequest<{ data: TeamSplit; actor: SplitActor }>(`/api/member/splits/${id}`, { signal });
      setSplit(result.data); setActor(result.actor);
    } catch (err) { if (!signal?.aborted) setError(err instanceof Error ? err.message : "Could not load split."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [id]);
  useEffect(() => { const controller = new AbortController(); setSplit(null); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function act(action: ActionInput) {
    if (!split || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await splitRequest<{ data: TeamSplit }>(`/api/member/splits/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...action, version: split.version } satisfies SplitAction),
      });
      setSplit(result.data);
      setNotice(action.action === "report" ? "Payment reported. Waiting for the creator to confirm receipt." : "Split updated.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update split."); }
    finally { setBusy(false); }
  }
  const owner = !!split && actor?.key === split.creator_key;
  const mine = split?.shares.find(s => s.memberId === actor?.memberId);
  const received = split?.shares.filter(s => s.status === "confirmed").reduce((sum, s) => sum + s.amountPaise, 0) ?? 0;
  return <div className="max-w-4xl space-y-6">
    <div className="flex items-center justify-between gap-3"><Link href="/dashboard/splits" className="text-sm text-gray-400 hover:text-white">← Team Splits</Link><button disabled={loading || busy} onClick={() => void load()} className="border border-white/15 px-3 py-2 text-xs text-gray-300 disabled:opacity-40">Refresh status</button></div>
    {error && <p role="alert" className="border border-red/40 p-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {loading ? <p role="status" className="text-gray-400">Loading split…</p> : split && <>
      <header><h1 className="break-words text-3xl font-bold text-white">{split.title}</h1><p className="mt-2 text-sm text-gray-400">Created by {split.creator_name} · {new Date(split.created_at).toLocaleDateString("en-IN")}</p>{split.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-300">{split.description}</p>}</header>
      <div className="grid gap-3 sm:grid-cols-3">{[["Total requested", split.total_paise], ["Confirmed received", received], ["Not yet confirmed", split.total_paise - received]].map(([label, amount]) => <div key={label} className="border border-white/15 p-4"><p className="text-xs text-gray-400">{label}</p><p className="mt-2 text-xl text-white">{formatRupees(Number(amount))}</p></div>)}</div>
      {split.status === "cancelled" ? <p className="border border-white/20 p-4 text-gray-300">This request was cancelled. Do not make a payment. Contact the creator if you already paid.</p> : received === split.total_paise ? <p className="border border-emerald-500/30 p-4 text-emerald-300">The creator has confirmed all payments.</p> : mine?.status === "unpaid" ? <PaymentPanel split={split} share={mine} busy={busy} onReport={reference => act({ action: "report", memberId: mine.memberId, reference })} /> : mine && <p className="border border-white/15 p-4 text-gray-300">{statusText[mine.status]}{mine.status === "reported" ? ". Do not pay again while waiting for confirmation." : "."}</p>}
      {owner && <p className="text-sm text-gray-400">Collecting at <span className="break-all text-white">{split.upi_id}</span> ({split.payee_name}). Confirm payments only after checking your receiving bank account.</p>}
      <section className="space-y-3"><h2 className="text-xl font-bold text-white">Participants</h2>{split.shares.map(share => <article key={share.memberId} className="border border-white/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-white">{share.name}{share.memberId === actor?.memberId ? " (you)" : ""}</h3><p className="mt-1 text-xs text-gray-400">{split.status === "cancelled" ? "Cancelled" : statusText[share.status]}</p></div><span className="text-white">{formatRupees(share.amountPaise)}</span></div>
        {share.reference && <p className="mt-2 break-all text-xs text-gray-300">Reported reference: {share.reference}</p>}
        {share.confirmedAt && <p className="mt-1 text-xs text-gray-500">Confirmed {new Date(share.confirmedAt).toLocaleString("en-IN")}</p>}
        {owner && share.note && <p className="mt-2 text-xs text-amber-200">Review note: {share.note}</p>}
        {owner && share.status === "reported" && split.status === "open" && <ReviewShare key={`${share.memberId}:${split.version}`} share={share} busy={busy} onAction={act} />}
      </article>)}</section>
      <details className="border border-white/15 p-4"><summary className="cursor-pointer text-sm text-gray-300">Payment activity</summary><ul className="mt-3 space-y-2 text-xs text-gray-400">{split.events.slice(-50).reverse().map((event, index) => <li key={`${event.at}:${index}`} className="break-words">{new Date(event.at).toLocaleString("en-IN")} · {({ created: "Request created", report: "Payment reported", confirm: "Receipt confirmed by creator", reject: "Returned for correction", cancel: "Request cancelled" } as Record<string, string>)[event.action]}{event.memberId ? ` · ${split.shares.find(s => s.memberId === event.memberId)?.name || "Member"}` : ""}{event.reference ? ` · ${event.reference}` : ""}{event.note ? ` · ${event.note}` : ""}</li>)}</ul></details>
      {owner && split.status === "open" && split.shares.every(s => s.status === "unpaid" && !s.reference) && <button disabled={busy} onClick={() => { if (window.confirm("Cancel this request? First check that nobody has paid you, including payments not reported here.")) void act({ action: "cancel" }); }} className="border border-red/30 px-4 py-2 text-sm text-red-300 disabled:opacity-40">Cancel request</button>}
    </>}
  </div>;
}
