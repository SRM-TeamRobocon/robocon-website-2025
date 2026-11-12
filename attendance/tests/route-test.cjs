const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./run.cjs');
const file = path.resolve(__dirname, '../../src/app/api/attendance/queued-tap/route.ts');
const helper = load(path.resolve(__dirname, '../../src/lib/attendance-device.ts'));
const tap = { eventId: 'a'.repeat(32), uid: '04A1B2C3', deviceId: 'test-scanner', timestamp: 1790000000000 };
let calls = 0, notifications = [], rpcError = null, duplicate = false;
const route = load(file, {
  'next/server': { after: callback => notifications.push(callback) },
  '@/lib/supabase/admin': { createSupabaseAdminClient: () => ({ rpc: async (name, args) => {
    calls++;
    assert.equal(name, 'record_queued_attendance_tap');
    assert.equal(args.p_scanned_at, new Date(tap.timestamp).toISOString());
    return { data: { event: 'tap', action: 'IN', name: 'Alice', duplicate }, error: rpcError };
  } }) },
  '@/lib/attendance': { broadcastAttendanceEvent: async () => {} },
  '@/lib/attendance-device': helper,
  '@/lib/attendance-reconcile': { reconcileMidnightAttendance: async () => {} },
  '@/lib/attendance-push': { sendAttendancePush: async () => {} },
});
const request = (body = JSON.stringify(tap), token = 'test-secret') => new Request('http://localhost/api/attendance/queued-tap', {
  method: 'POST', headers: { authorization: `Bearer ${token}` }, body,
});

(async () => {
  const originalSecret = process.env.ATTENDANCE_DEVICE_SECRET;
  try {
    delete process.env.ATTENDANCE_DEVICE_SECRET;
    assert.equal((await route.POST(request())).status, 503);
    process.env.ATTENDANCE_DEVICE_SECRET = 'test-secret';
    assert.equal((await route.POST(request(undefined, 'wrong'))).status, 401);
    for (const invalid of ['null', '[]', '{}', 'invalid json']) assert.equal((await route.POST(request(invalid))).status, 400);
    assert.equal((await route.POST(request('a'.repeat(513)))).status, 413);
    assert.equal(calls, 0);
    const response = await route.POST(request());
    assert.equal(response.status, 200);
    assert.equal(await response.text(), `${tap.eventId}\ntap\nIN\nAlice`);
    assert.equal(notifications.length, 1);
    duplicate = true;
    assert.equal((await route.POST(request())).status, 200);
    assert.equal(notifications.length, 1);
    rpcError = { code: 'test-error' };
    assert.equal((await route.POST(request())).status, 503);
    console.log('device route checks passed');
  } finally {
    if (originalSecret === undefined) delete process.env.ATTENDANCE_DEVICE_SECRET;
    else process.env.ATTENDANCE_DEVICE_SECRET = originalSecret;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
