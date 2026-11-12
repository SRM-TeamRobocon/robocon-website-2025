import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateShares, applySplitAction, canViewSplit, createSplitSchema, parseRupees,
  paymentUri, SplitError, splitActionSchema, splitForViewer,
  type SplitActor, type SplitMember, type TeamSplit,
} from "../../src/lib/team-splits";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];
const members: SplitMember[] = ids.slice(0, 3).map((id, index) => ({ id, name: `Member ${index + 1}`, domain: "TEAM" }));
const creator: SplitActor = { key: `member:${ids[3]}`, name: "Creator", memberId: ids[3] };
const payer: SplitActor = { key: `member:${ids[0]}`, name: "Payer", memberId: ids[0] };
const secondPayer: SplitActor = { key: `member:${ids[1]}`, name: "Second", memberId: ids[1] };
const stranger: SplitActor = { key: "staff:unrelated-admin", name: "Admin", memberId: null };
const now = "2026-11-12T12:00:00.000Z";

function input(total = "100.00") {
  return createSplitSchema.parse({
    id: "55555555-5555-4555-8555-555555555555", title: "Components", description: "Team expense",
    upiId: "creator@bank", payeeName: "Creator Name", total, mode: "equal",
    participants: members.map(m => ({ memberId: m.id })),
  });
}
function freshSplit(): TeamSplit {
  const request = input();
  const shares = allocateShares(request, members, creator.memberId);
  return {
    id: request.id, creator_key: creator.key, creator_name: creator.name,
    title: request.title, description: request.description, upi_id: request.upiId,
    payee_name: request.payeeName, total_paise: parseRupees(request.total),
    participant_ids: shares.map(s => s.memberId), shares, events: [], status: "open", version: 0, created_at: now,
  };
}
function errorStatus(status: number) {
  return (error: unknown) => error instanceof SplitError && error.status === status;
}
function report(split = freshSplit(), reference = "utr123456") {
  return applySplitAction(split, payer, { action: "report", memberId: payer.memberId!, reference, version: split.version }, now);
}

test("money parsing preserves paise and rejects unsafe or out-of-range inputs", () => {
  assert.equal(parseRupees("0.01"), 1);
  assert.equal(parseRupees("1.1"), 110);
  assert.equal(parseRupees("999999.99"), 99_999_999);
  assert.equal(parseRupees("1000000.00"), 100_000_000);
  for (const value of ["0", "-1", "1e3", "1.001", "NaN", "Infinity", ".5", "1.", "1,000", "1000000.01", " 1 "]) {
    assert.throws(() => parseRupees(value), errorStatus(400), value);
  }
});

test("equal shares sum exactly to the total with deterministic remainder allocation", () => {
  for (let totalPaise = 3; totalPaise < 1000; totalPaise++) {
    const shares = allocateShares(input((totalPaise / 100).toFixed(2)), members, creator.memberId);
    const amounts = shares.map(s => s.amountPaise);
    assert.equal(amounts.reduce((sum, value) => sum + value, 0), totalPaise);
    assert.ok(amounts.every(Number.isInteger));
    assert.ok(Math.max(...amounts) - Math.min(...amounts) <= 1);
  }
  assert.deepEqual(allocateShares(input(), members, creator.memberId).map(s => s.amountPaise), [3334, 3333, 3333]);
  assert.throws(() => allocateShares(input("0.02"), members, creator.memberId), errorStatus(400));
});

test("custom shares require exact positive totals", () => {
  const request = { ...input(), mode: "custom" as const, participants: members.map((m, i) => ({ memberId: m.id, amount: ["40", "30.25", "29.75"][i] })) };
  assert.deepEqual(allocateShares(request, members, creator.memberId).map(s => s.amountPaise), [4000, 3025, 2975]);
  assert.throws(() => allocateShares({ ...request, total: "99.99" }, members, creator.memberId), errorStatus(400));
  assert.throws(() => allocateShares({ ...request, participants: [{ memberId: ids[0], amount: "0" }] }, members, creator.memberId), errorStatus(400));
});

test("participants must be unique, approved, and different from the creator", () => {
  assert.throws(() => allocateShares({ ...input(), participants: [{ memberId: ids[0] }, { memberId: ids[0] }] }, members, creator.memberId), errorStatus(400));
  assert.throws(() => allocateShares(input(), members.slice(0, 2), creator.memberId), errorStatus(400));
  assert.throws(() => allocateShares(input(), members, ids[0]), errorStatus(400));
  const shares = allocateShares(input(), members, null);
  assert.deepEqual(shares.map(s => s.name), members.map(m => m.name));
});

test("request schemas reject forged ownership, malformed UPI IDs and empty participant lists", () => {
  assert.equal(createSplitSchema.safeParse({ ...input(), creator_key: "staff:someone" }).success, false);
  assert.equal(createSplitSchema.safeParse({ ...input(), upiId: "javascript:alert(1)" }).success, false);
  assert.equal(createSplitSchema.safeParse({ ...input(), upiId: "creator@bank&am=1" }).success, false);
  assert.equal(createSplitSchema.safeParse({ ...input(), participants: [] }).success, false);
  assert.equal(splitActionSchema.safeParse({ action: "confirm", memberId: ids[0], version: 0, amountPaise: 1 }).success, false);
  assert.equal(splitActionSchema.safeParse({ action: "reject", memberId: ids[0], version: 0, note: " " }).success, false);
  assert.equal(splitActionSchema.safeParse({ action: "report", memberId: ids[0], version: 0, reference: "<script>" }).success, false);
});

test("split visibility is limited to creator and participants, without an admin bypass", () => {
  const split = freshSplit();
  assert.equal(canViewSplit(split, creator), true);
  assert.equal(canViewSplit(split, payer), true);
  assert.equal(canViewSplit(split, stranger), false);
  assert.throws(() => splitForViewer(split, stranger), errorStatus(404));
  assert.throws(() => applySplitAction(split, stranger, { action: "cancel", version: 0 }, now), errorStatus(404));
});

test("reporting changes only the payer's share and never marks money confirmed", () => {
  const original = freshSplit();
  const next = report(original);
  assert.equal(next.version, 1);
  assert.equal(next.shares[0].status, "reported");
  assert.equal(next.shares[0].reference, "UTR123456");
  assert.equal(next.shares[0].confirmedAt, null);
  assert.equal(next.shares[1].status, "unpaid");
  assert.equal(next.events[0].actor, payer.key);
  assert.equal(original.version, 0);
  assert.equal(original.shares[0].status, "unpaid");
  assert.equal(original.events.length, 0);
});

test("another payer or the creator cannot report on behalf of a participant", () => {
  const split = freshSplit();
  for (const actor of [secondPayer, creator]) {
    assert.throws(() => applySplitAction(split, actor, { action: "report", memberId: ids[0], reference: "123456789012", version: 0 }, now), errorStatus(403));
  }
});

test("only the creator can confirm a submitted payment, and a confirmation cannot be repeated", () => {
  const pending = report();
  assert.throws(() => applySplitAction(pending, payer, { action: "confirm", memberId: ids[0], version: 1 }, now), errorStatus(403));
  assert.throws(() => applySplitAction(freshSplit(), creator, { action: "confirm", memberId: ids[0], version: 0 }, now), errorStatus(409));
  const confirmed = applySplitAction(pending, creator, { action: "confirm", memberId: ids[0], version: 1 }, now);
  assert.equal(confirmed.shares[0].status, "confirmed");
  assert.equal(confirmed.shares[0].confirmedAt, now);
  assert.equal(confirmed.version, 2);
  assert.throws(() => applySplitAction(confirmed, creator, { action: "confirm", memberId: ids[0], version: 2 }, now), errorStatus(409));
  assert.throws(() => report(confirmed), errorStatus(409));
});

test("stale versions cannot confirm or overwrite a newer report", () => {
  const pending = report();
  assert.throws(() => applySplitAction(pending, creator, { action: "confirm", memberId: ids[0], version: 0 }, now), errorStatus(409));
});

test("rejection retains an audit trail and allows corrected submission", () => {
  const pending = report();
  assert.throws(() => applySplitAction(pending, secondPayer, { action: "reject", memberId: ids[0], version: 1, note: "No match" }, now), errorStatus(403));
  const returned = applySplitAction(pending, creator, { action: "reject", memberId: ids[0], version: 1, note: "Reference does not match my statement" }, now);
  assert.equal(returned.shares[0].status, "unpaid");
  assert.equal(returned.shares[0].reference, "UTR123456");
  assert.match(returned.shares[0].note!, /does not match/);
  const corrected = report(returned, "UTR654321");
  assert.equal(corrected.shares[0].status, "reported");
  assert.equal(corrected.shares[0].note, null);
  assert.equal(corrected.events[0].reference, "UTR123456");
  assert.equal(corrected.events[2].reference, "UTR654321");
});

test("the same transaction reference cannot be reused by another participant", () => {
  const pending = report();
  assert.throws(() => applySplitAction(pending, secondPayer, { action: "report", memberId: ids[1], reference: "utr123456", version: 1 }, now), errorStatus(409));
});

test("only an untouched request can be cancelled by its creator", () => {
  assert.throws(() => applySplitAction(freshSplit(), payer, { action: "cancel", version: 0 }, now), errorStatus(403));
  const cancelled = applySplitAction(freshSplit(), creator, { action: "cancel", version: 0 }, now);
  assert.equal(cancelled.status, "cancelled");
  assert.throws(() => report(cancelled), errorStatus(409));
  const pending = report();
  assert.throws(() => applySplitAction(pending, creator, { action: "cancel", version: 1 }, now), errorStatus(409));
  const rejected = applySplitAction(pending, creator, { action: "reject", memberId: ids[0], version: 1, note: "Please check" }, now);
  assert.throws(() => applySplitAction(rejected, creator, { action: "cancel", version: 2 }, now), errorStatus(409));
});

test("participants cannot see another participant's reference, review note, or payment events", () => {
  let split = report();
  split = applySplitAction(split, secondPayer, { action: "report", memberId: ids[1], reference: "222222222222", version: split.version }, now);
  split = applySplitAction(split, creator, { action: "reject", memberId: ids[1], note: "Private review note", version: split.version }, now);
  split = applySplitAction(split, creator, { action: "confirm", memberId: ids[0], version: split.version }, now);
  const view = splitForViewer(split, payer);
  assert.equal(view.shares[0].reference, "UTR123456");
  assert.equal(view.shares[1].reference, null);
  assert.equal(view.shares[1].note, null);
  assert.equal(view.events.length, 2);
  assert.ok(view.events.every(e => e.memberId === ids[0]));
  assert.equal(view.events[1].actor, "creator");
  assert.equal(splitForViewer(split, creator).shares[1].reference, "222222222222");
  assert.equal(split.shares[1].note, "Private review note");
});

test("UPI payload preserves the exact recipient, amount and encoded name", () => {
  const split = { ...freshSplit(), payee_name: "Creator & Team / 2026" };
  const uri = new URL(paymentUri(split, split.shares[0]));
  assert.equal(uri.protocol, "upi:");
  assert.equal(uri.host, "pay");
  assert.equal(uri.searchParams.get("pa"), "creator@bank");
  assert.equal(uri.searchParams.get("pn"), split.payee_name);
  assert.equal(uri.searchParams.get("am"), "33.34");
  assert.equal(uri.searchParams.get("cu"), "INR");
  assert.equal(uri.searchParams.get("tn"), "Split 55555555 11111111");
});
