import { z } from "zod";

export interface SplitActor { key: string; name: string; memberId: string | null }
export interface SplitMember { id: string; name: string; domain: string }
export interface SplitShare {
  memberId: string;
  name: string;
  amountPaise: number;
  status: "unpaid" | "reported" | "confirmed";
  reference: string | null;
  reportedAt: string | null;
  confirmedAt: string | null;
  note: string | null;
  method?: "upi" | "cash" | "bank" | "self" | null;
  paymentNote?: string | null;
  remindedAt?: string | null;
}
export interface SplitEvent {
  action: string; actor: string; memberId: string | null; at: string;
  reference?: string; note?: string;
}
export type TeamSplit = {
  id: string;
  creator_key: string;
  creator_name: string;
  collector_member_id: string | null;
  collector_name: string | null;
  title: string;
  description: string;
  upi_id: string;
  payee_name: string;
  total_paise: number;
  participant_ids: string[];
  shares: SplitShare[];
  events: SplitEvent[];
  status: "open" | "cancelled";
  version: number;
  created_at: string;
  due_date?: string | null;
}
export class SplitError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Money is parsed as decimal text and kept in paise; no floating point division.
export function parseRupees(value: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) throw new SplitError("Enter an amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (paise < 1 || paise > 100_000_000) throw new SplitError("Amounts must be between ₹0.01 and ₹10,00,000.");
  return paise;
}
export function formatRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}
export const createSplitSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(""),
  upiId: z.string().trim().regex(/^[a-zA-Z0-9._-]{2,128}@[a-zA-Z0-9.-]{2,64}$/, "Enter a valid UPI ID."),
  payeeName: z.string().trim().min(2).max(100),
  collectorMemberId: z.string().uuid().nullable().default(null),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number(value.slice(0, 4)) > 0 && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Enter a valid date.").nullable().optional(),
  total: z.string().trim(),
  mode: z.enum(["equal", "custom"]),
  participants: z.array(z.object({ memberId: z.string().uuid(), amount: z.string().optional() })).min(1).max(100),
}).strict();
export const splitActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remind"), version: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("report"), memberId: z.string().uuid(), method: z.enum(["upi", "cash", "bank"]), reference: z.string().trim().max(40).default(""), paymentNote: z.string().trim().max(300).default(""), version: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("record"), memberId: z.string().uuid(), method: z.enum(["upi", "cash", "bank"]), reference: z.string().trim().max(40).default(""), paymentNote: z.string().trim().max(300).default(""), version: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("confirm"), memberId: z.string().uuid(), version: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("reject"), memberId: z.string().uuid(), note: z.string().trim().min(1).max(300), version: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("reopen"), memberId: z.string().uuid(), note: z.string().trim().min(1).max(300), version: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("cancel"), version: z.number().int().min(0) }).strict(),
]);
export type SplitAction = z.infer<typeof splitActionSchema>;

export function allocateShares(input: z.infer<typeof createSplitSchema>, members: SplitMember[], _creatorId: string | null): SplitShare[] {
  const total = parseRupees(input.total);
  const ids = input.participants.map(p => p.memberId);
  if (new Set(ids).size !== ids.length) throw new SplitError("Select each participant only once.");
  const names = new Map(members.map(m => [m.id, m.name]));
  const shares = input.participants.map((p, index) => {
    const name = names.get(p.memberId);
    if (!name) throw new SplitError("One or more participants are no longer approved members. Refresh and try again.");
    const amountPaise = input.mode === "equal"
      ? Math.floor(total / ids.length) + (index < total % ids.length ? 1 : 0)
      : parseRupees(p.amount ?? "");
    if (amountPaise < 1) throw new SplitError("Each participant's share must be at least ₹0.01.");
    return { memberId: p.memberId, name, amountPaise, status: "unpaid" as const, reference: null, reportedAt: null, confirmedAt: null, note: null };
  });
  if (shares.reduce((sum, s) => sum + s.amountPaise, 0) !== total) throw new SplitError("Custom shares must add up to the total amount.");
  return shares;
}
export function coverCollectorShare(shares: SplitShare[], collectorId: string | null, now: string): SplitShare[] {
  return shares.map(s => s.memberId === collectorId ? { ...s, status: "confirmed" as const, method: "self" as const, confirmedAt: now } : s);
}
export function canViewSplit(split: Pick<TeamSplit, "creator_key" | "participant_ids">, actor: SplitActor) {
  return split.creator_key === actor.key || (!!actor.memberId && (split.participant_ids.includes(actor.memberId) || ("collector_member_id" in split && split.collector_member_id === actor.memberId)));
}

export function collectorKey(split: Pick<TeamSplit, "collector_member_id" | "creator_key">) {
  return split.collector_member_id ? `member:${split.collector_member_id}` : split.creator_key;
}

export function canDeleteSplit(split: TeamSplit, actor: SplitActor) {
  return split.creator_key === actor.key && split.events.every(e => ["created", "cancel", "edit", "remind"].includes(e.action)) && split.shares.every(s => !s.reportedAt && (s.status === "unpaid" || s.method === "self"));
}

export function sameCreateRequest(split: TeamSplit, input: z.infer<typeof createSplitSchema>, creatorId: string | null) {
  if ((split.due_date ?? null) !== (input.dueDate ?? null)) return false;
  if (split.title !== input.title || split.description !== input.description || split.upi_id !== input.upiId || split.payee_name !== input.payeeName || (split.collector_member_id ?? null) !== input.collectorMemberId || split.total_paise !== parseRupees(input.total)) return false;
  const shares = allocateShares(input, split.shares.map(s => ({ id: s.memberId, name: s.name, domain: "" })), creatorId);
  return shares.length === split.shares.length && shares.every((s, i) => s.memberId === split.shares[i].memberId && s.amountPaise === split.shares[i].amountPaise);
}

export function applySplitAction(split: TeamSplit, actor: SplitActor, action: SplitAction, now: string): TeamSplit {
  if (!canViewSplit(split, actor)) throw new SplitError("Split not found.", 404);
  if (action.version !== split.version) throw new SplitError("This split changed. Refresh before trying again.", 409);
  if (split.status === "cancelled") throw new SplitError("This split was cancelled.", 409);
  if (split.events.length >= 1000) throw new SplitError("This split has reached its activity limit. Contact the creator.", 409);
  const next = { ...split, shares: split.shares.map(s => ({ ...s })), events: [...split.events], version: split.version + 1 };
  const event: SplitEvent = { action: action.action, actor: actor.key, memberId: "memberId" in action ? action.memberId : null, at: now };
  if (action.action === "remind") {
    if (collectorKey(split) !== actor.key) throw new SplitError("Only the collector can send reminders.", 403);
    const previous = split.events.filter(e => e.action === "remind").at(-1);
    if (previous && Date.parse(now) - Date.parse(previous.at) < 86400000) throw new SplitError("Wait 24 hours before sending another reminder.", 429);
    const unpaid = next.shares.filter(s => s.status === "unpaid");
    if (!unpaid.length) throw new SplitError("Nobody has an unpaid share.", 409);
    for (const share of unpaid) share.remindedAt = now;
    event.note = `Dashboard reminder sent to ${unpaid.length} unpaid members.`;
  } else if (action.action === "cancel") {
    if (split.creator_key !== actor.key) throw new SplitError("Only the creator can cancel this split.", 403);
    if (!canDeleteSplit(split, actor)) throw new SplitError("A payment has been recorded. Keep this request for the payment history.", 409);
    next.status = "cancelled";
  } else {
    const share = next.shares.find(s => s.memberId === action.memberId);
    if (!share) throw new SplitError("Participant not found.", 404);
    if (action.action === "report" || action.action === "record") {
      if (action.action === "report" && actor.memberId !== share.memberId) throw new SplitError("You can only report your own payment.", 403);
      if (action.action === "record" && actor.key !== collectorKey(split)) throw new SplitError("Only the collector can record a payment.", 403);
      if (share.status !== "unpaid" || share.method === "self") throw new SplitError("This share is already covered or awaiting review.", 409);
      const reference = action.reference.toUpperCase();
      if (action.method !== "cash" && !/^[A-Z0-9-]{6,40}$/.test(reference)) throw new SplitError("Enter the transaction reference for this transfer.");
      if (action.method === "cash" && !action.paymentNote) throw new SplitError("Add a note saying when or where cash was handed over.");
      if (reference && !/^[A-Z0-9-]{6,40}$/.test(reference)) throw new SplitError("Invalid transaction reference.");
      if (reference && next.shares.some(s => s.memberId !== share.memberId && s.status !== "unpaid" && s.reference === reference)) throw new SplitError("This reference is already reported in this split.", 409);
      share.status = action.action === "record" ? "confirmed" : "reported";
      share.method = action.method;
      share.paymentNote = action.paymentNote;
      share.reference = reference || null;
      share.reportedAt = now;
      share.note = null;
      if (action.action === "record") share.confirmedAt = now;
      if (reference) event.reference = reference;
      if (action.paymentNote) event.note = action.paymentNote;
    } else {
      if (actor.key !== collectorKey(split)) throw new SplitError("Only the collector can review payments.", 403);
      if (action.action === "reopen") {
        if (share.status !== "confirmed" || share.method === "self") throw new SplitError("Only a confirmed payment can be corrected.", 409);
        share.status = "unpaid";
        share.confirmedAt = null;
        share.note = action.note;
        event.note = action.note;
      } else {
        if (share.status !== "reported") throw new SplitError("Only submitted payments can be reviewed.", 409);
        if (action.action === "confirm") {
          share.status = "confirmed";
          share.confirmedAt = now;
        } else {
          share.status = "unpaid";
          share.note = action.note;
          event.note = action.note;
        }
      }
    }
  }
  next.events.push(event);
  return next;
}

export function splitForViewer(split: TeamSplit, actor: SplitActor): TeamSplit {
  if (!canViewSplit(split, actor)) throw new SplitError("Split not found.", 404);
  if (split.creator_key === actor.key || collectorKey(split) === actor.key) return split;
  return { ...split,
    shares: split.shares.map(s => s.memberId === actor.memberId ? s : { ...s, reference: null, note: null, paymentNote: null }),
    events: split.events.filter(e => e.memberId === actor.memberId).map(e => ({ ...e, actor: e.actor === actor.key ? actor.key : e.actor === split.creator_key ? "creator" : "collector" })),
  };
}
export function paymentUri(split: Pick<TeamSplit, "upi_id" | "payee_name" | "id">, share: Pick<SplitShare, "amountPaise" | "memberId">) {
  const params = new URLSearchParams({ pa: split.upi_id, pn: split.payee_name,
    am: (share.amountPaise / 100).toFixed(2), cu: "INR", tn: `Split ${split.id.slice(0, 8)} ${share.memberId.slice(0, 8)}` });
  return `upi://pay?${params.toString()}`;
}

export function editSplit(split: TeamSplit, actor: SplitActor, input: z.infer<typeof createSplitSchema>, members: SplitMember[], version: number, now: string): TeamSplit {
  if (split.version !== version) throw new SplitError("This split changed. Refresh before editing.", 409);
  if (split.status !== "open" || !canDeleteSplit(split, actor)) throw new SplitError("Only the creator can edit an open split before payment activity.", 403);
  if (split.events.length >= 1000) throw new SplitError("Activity limit reached.", 409);
  if (input.id !== split.id) throw new SplitError("Split ID cannot change.");
  const collector = input.collectorMemberId ? members.find(m => m.id === input.collectorMemberId) : null;
  if (input.collectorMemberId && !collector) throw new SplitError("Collector must be an approved member.");
  const shares = coverCollectorShare(allocateShares(input, members, actor.memberId), input.collectorMemberId ?? actor.memberId, now);
  return { ...split, title: input.title, description: input.description, upi_id: input.upiId, payee_name: input.payeeName,
    collector_member_id: input.collectorMemberId, collector_name: collector?.name ?? actor.name, due_date: input.dueDate ?? null,
    total_paise: parseRupees(input.total), shares, participant_ids: shares.map(s => s.memberId), version: version + 1,
    events: [...split.events, { action: "edit", actor: actor.key, memberId: null, at: now }] };
}

export function splitCsv(split: TeamSplit) {
  const cell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
  const rows = [["Member", "Amount INR", "Status", "Method", "Reference", "Confirmed at", "Due date"]];
  for (const s of split.shares) rows.push([s.name, (s.amountPaise / 100).toFixed(2), s.status, s.method ?? "", s.reference ?? "", s.confirmedAt ?? "", split.due_date ?? ""]);
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
}

export function isSplitOverdue(dueDate: string | null | undefined, now = new Date()) {
  // Due dates end at midnight in the team's India timezone.
  return !!dueDate && now.getTime() > Date.parse(`${dueDate}T23:59:59.999+05:30`);
}
