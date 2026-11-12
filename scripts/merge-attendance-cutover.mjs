// Run from the repository root. Default mode only reports differences.
// Apply an initial pass after a fresh database backup; repeat with writes paused at cutover.
// node scripts/merge-attendance-cutover.mjs --apply --initial
// node scripts/merge-attendance-cutover.mjs --apply --writes-paused
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.loadEnvFile('.env.local');

const OLD = 'https://fcdaqslblhrjzioeuloe.supabase.co';
const BACKUP = 'https://rfvefhdwebnebrvsedgf.supabase.co';
const oldKey = process.env.SUPABASE_SECRET_KEY;
const backupKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (process.env.SUPABASE_URL !== OLD || process.env.NEXT_PUBLIC_SUPABASE_URL !== BACKUP || !oldKey || !backupKey) {
  throw new Error('Supabase environment does not match the expected cutover projects');
}

function authHeaders(key, headers = {}) {
  const result = { ...headers, apikey: key };
  if (!key.startsWith('sb_secret_')) result.Authorization = `Bearer ${key}`;
  return result;
}

assert.equal(authHeaders('sb_secret_test').Authorization, undefined);
assert.equal(authHeaders('legacy-test').Authorization, 'Bearer legacy-test');

const apply = process.argv.includes('--apply');
const initial = process.argv.includes('--initial');
if (apply && !process.argv.includes('--writes-paused') && !initial) {
  throw new Error('Use --initial for a preliminary merge or pause attendance writes before final merge');
}
if (apply && initial) console.log('Preliminary merge: repeat after attendance writes are paused at cutover');

async function request(url, key, options = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: authHeaders(key, options.headers),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok || response.status < 500) return response;
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await new Promise((done) => setTimeout(done, (attempt + 1) * 1000));
  }
  throw new Error('Supabase request failed after retries');
}

async function rows(project, key, table, select = '*') {
  const result = [];
  for (let offset = 0; ; offset += 1000) {
    const url = `${project}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    const response = await request(url, key, { headers: { Range: `${offset}-${offset + 999}` } });
    if (!response.ok) throw new Error(`${table} read failed with HTTP ${response.status}`);
    const page = await response.json();
    result.push(...page);
    if (page.length < 1000) return result;
  }
}

const hash = (row) => createHash('sha256')
  .update(JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))))
  .digest('hex');

const [original, replacement, members] = await Promise.all([
  rows(OLD, oldKey, 'attendance_logs'),
  rows(BACKUP, backupKey, 'attendance_logs'),
  rows(OLD, oldKey, 'member_accounts', 'id'),
]);
const originalById = new Map(original.map((row) => [row.id, row]));
const replacementById = new Map(replacement.map((row) => [row.id, row]));
const missing = replacement.filter((row) => !originalById.has(row.id));
const conflicts = replacement.filter((row) => originalById.has(row.id) && hash(row) !== hash(originalById.get(row.id)));
const oldOnly = original.filter((row) => !replacementById.has(row.id));
const memberIds = new Set(members.map((row) => row.id));
const missingMembers = missing.filter((row) => !memberIds.has(row.member_account_id));

console.log(JSON.stringify({ original: original.length, replacement: replacement.length, missing: missing.length,
  oldOnly: oldOnly.length, conflicts: conflicts.length, missingMemberAccounts: missingMembers.length }));
if (conflicts.length || missingMembers.length) throw new Error('Merge requires manual review');
if (!apply || !missing.length) process.exitCode = 0;

if (apply && missing.length) {
  const snapshotDir = resolve('../robocon-backups/2026-11-11-cutover');
  mkdirSync(snapshotDir, { recursive: true });
  const snapshot = resolve(snapshotDir, `attendance-merge-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(snapshot, JSON.stringify({ source: BACKUP, target: OLD, original, added: missing }, null, 2),
    { flag: 'wx', mode: 0o600 });
  console.log(`Saved pre-merge snapshot: ${snapshot}`);

  const response = await request(`${OLD}/rest/v1/attendance_logs?on_conflict=id`, oldKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(missing),
  });
  if (!response.ok) throw new Error(`Attendance insert failed with HTTP ${response.status}`);

  const after = new Map((await rows(OLD, oldKey, 'attendance_logs')).map((row) => [row.id, row]));
  if (missing.some((row) => !after.has(row.id) || hash(after.get(row.id)) !== hash(row))) {
    throw new Error('Post-merge verification failed; inspect the saved snapshot');
  }
  console.log(`Verified ${missing.length} added attendance logs`);
}
