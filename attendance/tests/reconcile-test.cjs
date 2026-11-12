const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./run.cjs');
const math = load(path.resolve(__dirname, '../../src/lib/attendance.ts'));
const { reconcileMidnightAttendance } = load(path.resolve(__dirname, '../../src/lib/attendance-reconcile.ts'), {
  '@/lib/attendance': math,
});

(async () => {
  const now = Date.parse('2026-11-02T03:00:00Z');
  const boundary = math.istMidnightBoundary(now);
  let inserted;
  const supabase = { from: table => {
    const query = {
      select() { return this; }, gte() { return this; }, order() { return this; },
      eq() { return this; }, lte() { return this; },
      insert(rows) { inserted = rows; return Promise.resolve({ error: null }); },
      then(resolve, reject) {
        return Promise.resolve({ error: null, data: table === 'attendance_logs'
          ? [{ member_account_id: 'test-member', action: 'IN', occurred_at: new Date(boundary - 3600000).toISOString() }]
          : [] }).then(resolve, reject);
      },
    };
    return query;
  } };
  const result = await reconcileMidnightAttendance(supabase, now);
  assert.equal(result.checkedOut, 1);
  assert.equal(inserted[0].occurred_at, new Date(boundary).toISOString());
  assert.ok(Date.parse(inserted[0].occurred_at) < now);
  console.log('midnight reconciliation checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
