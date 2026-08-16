// Shared attendance math: used by the device-facing tap route, the member self-service
// routes, the auto-checkout cron, and the dashboard board. Domain/name are never stored
// per-tap — callers resolve those live from member_accounts -> members and pass them in.

export const PAIRING_WINDOW_MS = 60_000;
export const TAP_DEBOUNCE_MS = 3_000;

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
    stats.datesVisited.add(new Date(ts).toDateString());

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

  const midnights = Array.from(datesVisited)
    .map((d) => {
      const parsed = new Date(d);
      parsed.setHours(0, 0, 0, 0);
      return parsed.getTime();
    })
    .sort((a, b) => b - a);

  const ONE_DAY = 86_400_000;
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  let currentCheck: number;
  if (midnights[0] === todayMs) {
    currentCheck = todayMs;
  } else if (midnights[0] === todayMs - ONE_DAY) {
    currentCheck = todayMs - ONE_DAY;
  } else {
    return 0;
  }

  let streak = 0;
  for (const dayMs of midnights) {
    if (dayMs === currentCheck) {
      streak++;
      currentCheck -= ONE_DAY;
    } else if (dayMs < currentCheck) {
      break;
    }
  }
  return streak;
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
