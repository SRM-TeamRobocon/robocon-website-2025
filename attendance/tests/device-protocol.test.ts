import assert from "node:assert/strict";
import { parseQueuedTap, queuedTapReply } from "../../src/lib/attendance-device";

const tap = { eventId: "a".repeat(32), uid: "04A1B2C3", deviceId: "lobby-scanner-1", timestamp: 1_790_000_000_000 };
assert.deepEqual(parseQueuedTap(tap), tap);
assert.equal(parseQueuedTap({ ...tap, timestamp: 0 })?.timestamp, 0);
for (const invalid of [null, [], "string", 1, {}, { ...tap, uid: "A1B2C3" },
    { ...tap, uid: "04G1B2C3" }, { ...tap, timestamp: -1 }, { ...tap, timestamp: 1.5 },
    { ...tap, timestamp: Infinity }, { ...tap, timestamp: "123" },
    { ...tap, eventId: "b".repeat(31) }, { ...tap, deviceId: 'bad"id' }]) {
    assert.equal(parseQueuedTap(invalid), null);
}
const reply = queuedTapReply(tap.eventId, { event: "tap", action: "IN", name: "Alice\n\rTest" });
assert.equal(reply, `${tap.eventId}\ntap\nIN\nAlice  Test`);
assert.equal(reply.split("\n").length, 4);
assert.equal(queuedTapReply(tap.eventId, { event: "review" }), `${tap.eventId}\nreview\n\n`);
console.log("device protocol checks passed");
