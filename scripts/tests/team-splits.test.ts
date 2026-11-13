import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateShares, applySplitAction, canDeleteSplit, canViewSplit, coverCollectorShare, createSplitSchema, parseRupees,
  paymentUri, sameCreateRequest, editSplit, isSplitOverdue, splitCsv, SplitError, splitActionSchema, splitForViewer,
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
    id: request.id, creator_key: creator.key, creator_name: creator.name, collector_member_id: null, collector_name: creator.name,
    title: request.title, description: request.description, upi_id: request.upiId,
    payee_name: request.payeeName, total_paise: parseRupees(request.total),
    participant_ids: shares.map(s => s.memberId), shares, events: [], status: "open", version: 0, created_at: now,
  };
}
function errorStatus(status: number) {
  return (error: unknown) => error instanceof SplitError && error.status === status;
}
function report(split = freshSplit(), reference = "utr123456") {
  return applySplitAction(split, payer, { action: "report", memberId: payer.memberId!, method: "upi", reference, paymentNote: "", version: split.version }, now);
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

test("participants must be unique and approved; creator can be included", () => {
  assert.throws(() => allocateShares({ ...input(), participants: [{ memberId: ids[0] }, { memberId: ids[0] }] }, members, creator.memberId), errorStatus(400));
  assert.throws(() => allocateShares(input(), members.slice(0, 2), creator.memberId), errorStatus(400));
  assert.equal(allocateShares(input(), members, ids[0])[0].memberId, ids[0]);
  const shares = allocateShares(input(), members, null);
  assert.deepEqual(shares.map(s => s.name), members.map(m => m.name));
});

test("collector share is covered without recording an incoming payment", () => {
  const shares = allocateShares(input(), members, null);
  const covered = coverCollectorShare(shares, ids[1], now);
  assert.equal(covered[1].status, "confirmed");
  assert.equal(covered[1].method, "self");
  assert.equal(covered[1].confirmedAt, now);
  assert.equal(covered[0].status, "unpaid");
  assert.equal(shares[1].status, "unpaid");
});

test("request schemas reject forged ownership, malformed UPI IDs and empty participant lists", () => {
  assert.equal(createSplitSchema.safeParse({ ...input(), creator_key: "staff:someone" }).success, false);
  assert.equal(createSplitSchema.safeParse({ ...input(), upiId: "javascript:alert(1)" }).success, false);
  assert.equal(createSplitSchema.safeParse({ ...input(), upiId: "creator@bank&am=1" }).success, false);
  assert.equal(createSplitSchema.safeParse({ ...input(), participants: [] }).success, false);
  assert.equal(splitActionSchema.safeParse({ action: "confirm", memberId: ids[0], version: 0, amountPaise: 1 }).success, false);
  assert.equal(splitActionSchema.safeParse({ action: "reject", memberId: ids[0], version: 0, note: " " }).success, false);
  assert.equal(splitActionSchema.safeParse({ action: "report", memberId: ids[0], version: 0, method: "upi", reference: "<script>", paymentNote: "" }).success, true);
  assert.throws(() => applySplitAction(freshSplit(), payer, { action: "report", memberId: ids[0], method: "upi", reference: "<script>", paymentNote: "", version: 0 }, now), errorStatus(400));
});

test("creation retries match the original payment request", () => {
  const split = freshSplit();
  assert.equal(sameCreateRequest(split, input(), creator.memberId), true);
  assert.equal(sameCreateRequest(split, { ...input(), upiId: "other@bank" }, creator.memberId), false);
  assert.equal(sameCreateRequest(split, { ...input(), collectorMemberId: ids[1] }, creator.memberId), false);
  assert.equal(sameCreateRequest(split, { ...input(), total: "101.00" }, creator.memberId), false);
  assert.equal(sameCreateRequest(split, { ...input(), participants: [...input().participants].reverse() }, creator.memberId), false);
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
    assert.throws(() => applySplitAction(split, actor, { action: "report", memberId: ids[0], method: "upi", reference: "123456789012", paymentNote: "", version: 0 }, now), errorStatus(403));
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
  assert.throws(() => applySplitAction(pending, secondPayer, { action: "report", memberId: ids[1], method: "upi", reference: "utr123456", paymentNote: "", version: 1 }, now), errorStatus(409));
  const rejected = applySplitAction(pending, creator, { action: "reject", memberId: ids[0], version: 1, note: "No matching payment" }, now);
  const corrected = applySplitAction(rejected, secondPayer, { action: "report", memberId: ids[1], method: "upi", reference: "utr123456", paymentNote: "", version: 2 }, now);
  assert.equal(corrected.shares[1].status, "reported");
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
  split = applySplitAction(split, secondPayer, { action: "report", memberId: ids[1], method: "upi", reference: "222222222222", paymentNote: "", version: split.version }, now);
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

test("a separate collector can review while the creator can still owe a share", () => {
  const split = freshSplit();
  split.collector_member_id = ids[1];
  split.collector_name = "Member 2";
  split.participant_ids.push(creator.memberId!);
  split.shares.push({ memberId: creator.memberId!, name: creator.name, amountPaise: 100, status: "unpaid", reference: null, reportedAt: null, confirmedAt: null, note: null });
  assert.equal(canViewSplit(split, secondPayer), true);
  assert.throws(() => applySplitAction(report(split), creator, { action: "confirm", memberId: ids[0], version: 1 }, now), errorStatus(403));
  const pending = report(split);
  const confirmed = applySplitAction(pending, secondPayer, { action: "confirm", memberId: ids[0], version: 1 }, now);
  assert.equal(confirmed.shares[0].status, "confirmed");
});

test("cash requires a note and the collector can record it for an absent member", () => {
  const split = freshSplit();
  assert.throws(() => applySplitAction(split, payer, { action: "report", memberId: ids[0], method: "cash", reference: "", paymentNote: "", version: 0 }, now), errorStatus(400));
  const pending = applySplitAction(split, payer, { action: "report", memberId: ids[0], method: "cash", reference: "", paymentNote: "Given at workshop", version: 0 }, now);
  assert.equal(pending.shares[0].status, "reported");
  assert.equal(pending.shares[0].method, "cash");
  assert.throws(() => applySplitAction(split, payer, { action: "record", memberId: ids[1], method: "cash", reference: "", paymentNote: "At workshop", version: 0 }, now), errorStatus(403));
  const recorded = applySplitAction(pending, creator, { action: "record", memberId: ids[1], method: "cash", reference: "", paymentNote: "At workshop", version: 1 }, now);
  assert.equal(recorded.shares[1].status, "confirmed");
  assert.equal(recorded.events[1].action, "record");
});

test("confirmed payments can be reopened with a reason and cannot be deleted", () => {
  const split = freshSplit();
  assert.equal(canDeleteSplit(split, creator), true);
  const confirmed = applySplitAction(report(split), creator, { action: "confirm", memberId: ids[0], version: 1 }, now);
  assert.equal(canDeleteSplit(confirmed, creator), false);
  assert.throws(() => applySplitAction(confirmed, payer, { action: "reopen", memberId: ids[0], note: "Refunded", version: 2 }, now), errorStatus(403));
  const reopened = applySplitAction(confirmed, creator, { action: "reopen", memberId: ids[0], note: "Refunded", version: 2 }, now);
  assert.equal(reopened.shares[0].status, "unpaid");
  assert.equal(reopened.shares[0].confirmedAt, null);
  assert.equal(reopened.events[2].note, "Refunded");
  assert.equal(canDeleteSplit(reopened, creator), false);
});

test("reminders target unpaid shares, require collector permission, and enforce a daily cooldown", () => {
  const pending = report();
  assert.throws(() => applySplitAction(pending, payer, { action: "remind", version: 1 }, now), errorStatus(403));
  const reminded = applySplitAction(pending, creator, { action: "remind", version: 1 }, now);
  assert.equal(reminded.shares[0].remindedAt, undefined);
  assert.equal(reminded.shares[1].remindedAt, now);
  assert.throws(() => applySplitAction(reminded, creator, { action: "remind", version: 2 }, now), errorStatus(429));
  assert.equal(applySplitAction(reminded, creator, { action: "remind", version: 2 }, "2026-11-13T12:00:00.000Z").version, 3);
});

test("unused splits can be edited with fresh shares but payment history locks edits", () => {
  const original = freshSplit();
  const changed = { ...input("120.00"), collectorMemberId: ids[1], dueDate: "2026-12-01" };
  const edited = editSplit(original, creator, changed, members, 0, now);
  assert.equal(edited.total_paise, 12000);
  assert.equal(edited.shares[1].method, "self");
  assert.equal(edited.due_date, "2026-12-01");
  assert.equal(edited.events[0].action, "edit");
  assert.equal(canDeleteSplit(edited, creator), true);
  assert.throws(() => editSplit(original, payer, changed, members, 0, now), errorStatus(403));
  assert.throws(() => editSplit(edited, creator, changed, members, 0, now), errorStatus(409));
  assert.throws(() => editSplit(report(), creator, changed, members, 1, now), errorStatus(403));
  assert.equal(original.total_paise, 10000);
});

test("due dates reject impossible days and become overdue after the India day ends", () => {
  assert.equal(createSplitSchema.safeParse({ ...input(), dueDate: "2026-02-30" }).success, false);
  assert.equal(isSplitOverdue("2026-11-13", new Date("2026-11-13T18:29:59.000Z")), false);
  assert.equal(isSplitOverdue("2026-11-13", new Date("2026-11-13T18:30:00.000Z")), true);
  assert.equal(isSplitOverdue(null), false);
});

test("CSV exports preserve paise and quote spreadsheet formulas, commas and newlines safely", () => {
  const split = freshSplit();
  split.shares[0].name = '=HYPERLINK("bad")';
  split.shares[1].name = 'Member, "Two"\nTeam';
  const csv = splitCsv(split);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"Member, ""Two""\nTeam"'));
  assert.ok(csv.includes('"33.34"'));
});
