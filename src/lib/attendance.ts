// Shared attendance math: used by the device-facing tap route, the member self-service
// routes, the auto-checkout cron, and the dashboard board. Domain/name are never stored
// per-tap — callers resolve those live from member_accounts -> members and pass them in.

export const PAIRING_WINDOW_MS = 60_000;
export const TAP_DEBOUNCE_MS = 3_000;

// Backstop lifetime for an overnight pass. The midnight sweep normally resolves a
// pass the same night it's claimed, so this only matters if the cron doesn't fire at
// all — it stops a pass from sitting "active" forever and silently covering some
// later night. Long enough that a pass claimed at any hour still covers the next
// midnight sweep.
export const OVERNIGHT_PASS_TTL_MS = 26 * 60 * 60 * 1000;

// IST is a fixed UTC+5:30 with no DST, so a plain offset is exact — no tz library.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The IST calendar date a timestamp falls on, as "YYYY-MM-DD" — independent of the
// server process's own local timezone (Vercel runs UTC). Shifting by the offset before
// reading UTC fields back out gives the IST date regardless of where this runs.
// Streak/attendance-day bucketing must go through this rather than Date.prototype
// .toDateString()/.setHours(), which read the *server's* local time — on Vercel that's
// UTC, so anyone tapping between 00:00-05:29 IST (an ordinary time to still be in the
// lab) got bucketed onto the wrong calendar day and their streak silently broke.
function istDateKey(ts: number): string {
  return new Date(ts + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Which "night" a pass belongs to, as an IST calendar date. Claimed at 23:00 on the
// 17th → "…-17"; claimed at 02:00 on the 18th you're still in the same night, so it's
// also "…-17". This is a label for the UI ("pass active for the night of X") — the
// sweep's skip decision runs off `status`, never off this date.
export function istNightOf(nowMs: number): string {
  const ist = new Date(nowMs + IST_OFFSET_MS);
  if (ist.getUTCHours() < 6) ist.setUTCDate(ist.getUTCDate() - 1);
  return ist.toISOString().slice(0, 10);
}

// Used only to estimate a duration when a session's matching OUT is missing/anomalous
// (e.g. the auto-checkout cron closed it, or a session spans an absurd length).
const FIXED_SESSION_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_SESSION_MS = 30 * 60 * 60 * 1000; // 30 hours — beyond this we treat it as anomalous

export function normalizeRfidUid(raw: string): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export type AttendanceAction = "IN" | "OUT";

export function nextAction(latest: AttendanceAction | null | undefined): AttendanceAction {
  return latest === "IN" ? "OUT" : "IN";
}

export interface AttendanceEvent {
  memberAccountId: string;
  name: string;
  domain: string;
  action: AttendanceAction;
  occurredAt: string; // ISO timestamp
}

export interface MemberAttendanceStats {
  memberAccountId: string;
  name: string;
  domain: string;
  status: AttendanceAction;
  totalTimeMs: number;
  lastTapMs: number;
  currentStreak: number;
}

// One row of the "ghost board": members ranked by how many sessions the midnight
// sweep had to close for them because they walked out without tapping out. Nights
// covered by an overnight pass never produce an auto_checkout row, so they can't
// land anyone here.
export interface GhostStat {
  memberAccountId: string;
  name: string;
  domain: string;
  count: number;
  lastAt: string;
}

export function calculateStats(events: AttendanceEvent[], nowMs: number): MemberAttendanceStats[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const byMember = new Map<
    string,
    MemberAttendanceStats & { openSinceMs: number | null; datesVisited: Set<string> }
  >();

  for (const event of sorted) {
    if (!byMember.has(event.memberAccountId)) {
      byMember.set(event.memberAccountId, {
        memberAccountId: event.memberAccountId,
        name: event.name,
        domain: event.domain,
        status: "OUT",
        totalTimeMs: 0,
        lastTapMs: 0,
        currentStreak: 0,
        openSinceMs: null,
        datesVisited: new Set(),
      });
    }
    const stats = byMember.get(event.memberAccountId)!;
    stats.name = event.name;
    stats.domain = event.domain;

    const ts = Date.parse(event.occurredAt);
    stats.datesVisited.add(istDateKey(ts));

    if (event.action === "IN") {
      stats.status = "IN";
      stats.openSinceMs = ts;
      stats.lastTapMs = ts;
    } else {
      stats.lastTapMs = ts;
      if (stats.status === "IN" && stats.openSinceMs !== null) {
        const dur = ts - stats.openSinceMs;
        stats.totalTimeMs += dur > MAX_SESSION_MS ? FIXED_SESSION_MS : dur;
      }
      stats.status = "OUT";
      stats.openSinceMs = null;
    }
  }

  // Add elapsed time for anyone still checked in right now.
  for (const stats of Array.from(byMember.values())) {
    if (stats.status === "IN" && stats.openSinceMs !== null) {
      const dur = nowMs - stats.openSinceMs;
      stats.totalTimeMs += dur > MAX_SESSION_MS ? FIXED_SESSION_MS : dur;
    }
  }

  const results: MemberAttendanceStats[] = [];
  for (const stats of Array.from(byMember.values())) {
    results.push({
      memberAccountId: stats.memberAccountId,
      name: stats.name,
      domain: stats.domain,
      status: stats.status,
      totalTimeMs: stats.totalTimeMs,
      lastTapMs: stats.lastTapMs,
      currentStreak: calculateStreak(stats.datesVisited, nowMs),
    });
  }
  return results;
}

function calculateStreak(datesVisited: Set<string>, nowMs: number): number {
  if (datesVisited.size === 0) return 0;

  const ONE_DAY = 86_400_000;

  // A streak still counts as "current" if today has no visit yet but yesterday does
  // (e.g. checking the board at 9am before anyone's tapped in today) — start walking
  // from whichever of the two is the most recent IST day actually present.
  let cursor: number;
  if (datesVisited.has(istDateKey(nowMs))) {
    cursor = nowMs;
  } else if (datesVisited.has(istDateKey(nowMs - ONE_DAY))) {
    cursor = nowMs - ONE_DAY;
  } else {
    return 0;
  }

  let streak = 0;
  while (datesVisited.has(istDateKey(cursor))) {
    streak++;
    cursor -= ONE_DAY;
  }
  return streak;
}

// Formats a Date for an <input type="datetime-local"> value, in the browser's own
// local time (deliberately NOT IST-shifted — this reflects what the input element
// itself expects to render/parse against the viewer's clock).
export function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDuration(ms: number): string {
  if (ms < 0) return "0h 0m";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export interface AttendanceSession {
  memberAccountId: string;
  name: string;
  domain: string;
  inAt: string;
  outAt: string | null;
  durationMs: number;
}

// Pairs consecutive IN/OUT events into sessions per member, for history views + CSV export.
export function buildSessions(events: AttendanceEvent[], nowMs: number): AttendanceSession[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const openByMember = new Map<string, AttendanceEvent>();
  const sessions: AttendanceSession[] = [];

  for (const event of sorted) {
    if (event.action === "IN") {
      openByMember.set(event.memberAccountId, event);
    } else {
      const open = openByMember.get(event.memberAccountId);
      if (open) {
        const dur = Date.parse(event.occurredAt) - Date.parse(open.occurredAt);
        sessions.push({
          memberAccountId: event.memberAccountId,
          name: open.name,
          domain: open.domain,
          inAt: open.occurredAt,
          outAt: event.occurredAt,
          durationMs: dur > MAX_SESSION_MS ? FIXED_SESSION_MS : dur,
        });
        openByMember.delete(event.memberAccountId);
      }
    }
  }

  // Anyone still open is an ongoing session.
  for (const open of Array.from(openByMember.values())) {
    sessions.push({
      memberAccountId: open.memberAccountId,
      name: open.name,
      domain: open.domain,
      inAt: open.occurredAt,
      outAt: null,
      durationMs: nowMs - Date.parse(open.occurredAt),
    });
  }

  return sessions.sort((a, b) => Date.parse(b.inAt) - Date.parse(a.inAt));
}

// Server-side "broadcast without a websocket" send, via Supabase Realtime's REST
// broadcast endpoint — the tap route runs as a one-shot serverless function, so it
// can't hold a subscribed channel open to push a message the normal client-side way.
export async function broadcastAttendanceEvent(payload: {
  event: "tap" | "linked";
  name: string;
  domain?: string;
  action?: AttendanceAction;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [{ topic: "attendance-live", event: "attendance", payload, private: false }],
      }),
    });
  } catch (err) {
    // Live board falls back to its periodic re-fetch — never let this fail the tap.
    console.error("attendance broadcast failed", err);
  }
}

export function generateSessionCSV(sessions: AttendanceSession[]): string {
  const headers = ["Name", "Domain", "In", "Out", "Duration"];
  const rows = sessions.map((s) =>
    [
      `"${s.name}"`,
      `"${s.domain}"`,
      `"${new Date(s.inAt).toLocaleString()}"`,
      `"${s.outAt ? new Date(s.outAt).toLocaleString() : "Still in"}"`,
      `"${formatDuration(s.durationMs)}"`,
    ].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
