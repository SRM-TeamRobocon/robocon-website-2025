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
}
export interface SplitEvent {
  action: string; actor: string; memberId: string | null; at: string;
  reference?: string; note?: string;
}
export type TeamSplit = {
  id: string;
  creator_key: string;
  creator_name: string;
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
  total: z.string().trim(),
  mode: z.enum(["equal", "custom"]),
  participants: z.array(z.object({ memberId: z.string().uuid(), amount: z.string().optional() })).min(1).max(100),
}).strict();
export const splitActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("report"), memberId: z.string().uuid(), reference: z.string().trim().regex(/^[a-zA-Z0-9-]{6,40}$/, "Enter the transaction reference from your UPI app."), version: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("confirm"), memberId: z.string().uuid(), version: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("reject"), memberId: z.string().uuid(), note: z.string().trim().min(1).max(300), version: z.number().int().min(0) }).strict(),
  z.object({ action: z.literal("cancel"), version: z.number().int().min(0) }).strict(),
]);
export type SplitAction = z.infer<typeof splitActionSchema>;

export function allocateShares(input: z.infer<typeof createSplitSchema>, members: SplitMember[], creatorId: string | null): SplitShare[] {
  const total = parseRupees(input.total);
  const ids = input.participants.map(p => p.memberId);
  if (new Set(ids).size !== ids.length) throw new SplitError("Select each participant only once.");
  if (creatorId && ids.includes(creatorId)) throw new SplitError("Enter the amount to collect from other members, excluding your own share.");
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
export function canViewSplit(split: Pick<TeamSplit, "creator_key" | "participant_ids">, actor: SplitActor) {
  return split.creator_key === actor.key || (!!actor.memberId && split.participant_ids.includes(actor.memberId));
}

export function sameCreateRequest(split: TeamSplit, input: z.infer<typeof createSplitSchema>, creatorId: string | null) {
  if (split.title !== input.title || split.description !== input.description || split.upi_id !== input.upiId || split.payee_name !== input.payeeName || split.total_paise !== parseRupees(input.total)) return false;
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
  if (action.action === "cancel") {
    if (split.creator_key !== actor.key) throw new SplitError("Only the creator can cancel this split.", 403);
    if (split.shares.some(s => s.reference || s.status !== "unpaid")) throw new SplitError("A payment has been reported. Resolve it with the payer before closing the request.", 409);
    next.status = "cancelled";
  } else {
    const share = next.shares.find(s => s.memberId === action.memberId);
    if (!share) throw new SplitError("Participant not found.", 404);
    if (action.action === "report") {
      if (actor.memberId !== share.memberId) throw new SplitError("You can only report your own payment.", 403);
      if (share.status !== "unpaid") throw new SplitError("This payment has already been submitted.", 409);
      const reference = action.reference.toUpperCase();
      if (next.shares.some(s => s.memberId !== share.memberId && s.status !== "unpaid" && s.reference === reference)) throw new SplitError("This reference is already reported in this split.", 409);
      share.status = "reported";
      share.reference = reference;
      share.reportedAt = now;
      share.note = null;
      event.reference = reference;
    } else {
      if (actor.key !== split.creator_key) throw new SplitError("Only the creator can review payments.", 403);
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
  next.events.push(event);
  return next;
}

export function splitForViewer(split: TeamSplit, actor: SplitActor): TeamSplit {
  if (!canViewSplit(split, actor)) throw new SplitError("Split not found.", 404);
  if (split.creator_key === actor.key) return split;
  return { ...split,
    shares: split.shares.map(s => s.memberId === actor.memberId ? s : { ...s, reference: null, note: null }),
    events: split.events.filter(e => e.memberId === actor.memberId).map(e => ({ ...e, actor: e.actor === actor.key ? actor.key : "creator" })),
  };
}
export function paymentUri(split: Pick<TeamSplit, "upi_id" | "payee_name" | "id">, share: Pick<SplitShare, "amountPaise" | "memberId">) {
  const params = new URLSearchParams({ pa: split.upi_id, pn: split.payee_name,
    am: (share.amountPaise / 100).toFixed(2), cu: "INR", tn: `Split ${split.id.slice(0, 8)} ${share.memberId.slice(0, 8)}` });
  return `upi://pay?${params.toString()}`;
}
