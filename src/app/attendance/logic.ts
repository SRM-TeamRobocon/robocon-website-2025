export interface AttendanceMember {
  uid: string;
  name: string;
  domain: string;
}

const DEFAULT_DOMAIN = "GENERAL";
const DEFAULT_NAME_PREFIX = "Member";
const FIXED_SESSION_MS = 4 * 60 * 60 * 1000;
const MAX_VALID_SESSION_MS = 15 * 60 * 60 * 1000;

const ATTENDANCE_UID_ALIASES: Record<string, string> = {
  // Historical sheet formatting issue for Nithya (scientific notation)
  "955E57": "9548E54",
};

const ATTENDANCE_MEMBERS: AttendanceMember[] = [
  { uid: "A9DC6F63", name: "Anubhav", domain: "SPACED" },
  { uid: "493FEAB", name: "Abraham", domain: "MCSOD" },
  { uid: "895D8654", name: "Rayyah", domain: "SPACED" },
  { uid: "99ECB9D", name: "K Manish", domain: "SAMBED" },
  { uid: "F9A537AC", name: "Rijul", domain: "SAMBED" },
  { uid: "F968AB94", name: "Syed Misbahul", domain: "MCSOD" },
  { uid: "F94A9894", name: "Vrashni", domain: "SIESED" },
  { uid: "9EE14AB", name: "Niranjana", domain: "SIESED" },
  { uid: "A918A994", name: "Sangamithraa", domain: "SAMBED" },
  { uid: "29A6C09D", name: "Shaziya", domain: "SIESED" },
  { uid: "9DE18AB", name: "Deepa", domain: "MCSOD" },
  { uid: "79859A94", name: "Shresth", domain: "SAMBED" },
  { uid: "A95D8654", name: "Smriti Dubey", domain: "MCSOD" },
  { uid: "B9C62E6C", name: "TEAM LEAD", domain: "TEAM" },
  { uid: "E9818E54", name: "Ashwin", domain: "MCSOD" },
  { uid: "39999D94", name: "Arshia Gupta", domain: "SPACED" },
  { uid: "89EA17AB", name: "Krish Parekh", domain: "SPACED" },
  { uid: "4946AA94", name: "Aman Chouhan", domain: "SPACED" },
  { uid: "E9ECA894", name: "Adarsh Mittal", domain: "SPACED" },
  { uid: "49EAA994", name: "Swastika", domain: "MCSOD" },
  { uid: "79A24AB", name: "Soham", domain: "MCSOD" },
  { uid: "697713AB", name: "Bhaskar", domain: "SIESED" },
  { uid: "29EBC39D", name: "Karthik", domain: "SIESED" },
  { uid: "C98E23AB", name: "Rajat", domain: "SPACED" },
  { uid: "29781BAB", name: "Nitiraj", domain: "MCSOD" },
  { uid: "29908754", name: "Nilesh", domain: "SIESED" },
  { uid: "E9689054", name: "Mohamed Abdullah", domain: "SIESED" },
  { uid: "4929BD9D", name: "Daksh", domain: "SPACED" },
  { uid: "29D35E61", name: "Tanisha", domain: "SAMBED" },
  { uid: "D92E9994", name: "Vineet", domain: "SIESED" },
  { uid: "D9CCBB9D", name: "Keerthana", domain: "SAMBED" },
  { uid: "79F28654", name: "Samparna", domain: "SAMBED" },
  { uid: "D94419AB", name: "Bhargave", domain: "SIESED" },
  { uid: "8949D162", name: "Dominic", domain: "SPACED" },
  { uid: "4920A594", name: "Pranav", domain: "MCSOD" },
  { uid: "19979B94", name: "Nimish", domain: "SAMBED" },
  { uid: "C975A294", name: "Swarnava", domain: "SPACED" },
  { uid: "2965A994", name: "Ananya", domain: "MCSOD" },
  { uid: "C9C89F94", name: "Devdath", domain: "SIESED" },
  { uid: "B9C79594", name: "Swapneel", domain: "SPACED" },
  { uid: "9118D54", name: "Rohan", domain: "MCSOD" },
  { uid: "698F9D94", name: "Mireya", domain: "SAMBED" },
  { uid: "298A194", name: "Yashodhara", domain: "MCSOD" },
  { uid: "9548E54", name: "Nithya Guru", domain: "SAMBED" },
  { uid: "59F2A794", name: "Sana", domain: "SAMBED" },
  { uid: "99A06661", name: "Agamjot Kaur", domain: "MCSOCD" },
];

export interface TapLog {
  Name: string;
  UID: string;
  Date: string;
  Time: string;
  timestamp: number;
  action?: "IN" | "OUT";
  domain?: string;
  reason?: string;
}

export interface UserStats {
  UID: string;
  Name: string;
  Domain: string;
  status: "IN" | "OUT";
  totalTimeMs: number;
  overallTotalTimeMs: number;
  lastTapMs: number;
  currentStreak: number;
}

const MEMBER_BY_UID = new Map<string, AttendanceMember>(
  ATTENDANCE_MEMBERS.map((m) => [normalizeUid(m.uid), m])
);

export function parseCSV(csvString: string): TapLog[] {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const results: TapLog[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length >= 4) {
      const actionRaw = values[4] ? values[4].trim().toUpperCase() : "";
      const action = (actionRaw === "IN" || actionRaw === "OUT") ? actionRaw as "IN" | "OUT" : undefined;
      const normalizedUid = normalizeUid(values[1]);
      const member = getMemberFromUid(normalizedUid);
      const fallbackName = buildFallbackName(normalizedUid);
      const rawName = values[0] ? values[0].trim() : "";
      const rawDomain = values[5] ? values[5].trim().toUpperCase() : "";
      const rawReason = values[6] ? values[6].trim().toUpperCase() : "";
      
      const log: TapLog = {
        Name: rawName || member?.name || fallbackName,
        UID: normalizedUid,
        Date: values[2],
        Time: values[3],
        timestamp: parseDateTime(values[2], values[3]),
        action,
        domain: normalizeDomain(rawDomain || member?.domain || DEFAULT_DOMAIN),
        reason: rawReason
      };
      if (!isNaN(log.timestamp)) results.push(log);
    }
  }
  return results;
}

function parseDateTime(dateStr: string, timeStr: string): number {
  if (!dateStr || !timeStr) return NaN;
  const cleanTime = timeStr.replace(/\./g, ':');

  // Try DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${cleanTime}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  // Try YYYY-MM-DD (ISO)
  const d = new Date(`${dateStr}T${cleanTime}`);
  return d.getTime();
}

export function parseData(data: any): TapLog[] {
  if (Array.isArray(data)) {
    const results: TapLog[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 4) {
        const actionRaw = row[4] ? String(row[4]).trim().toUpperCase() : "";
        const action = (actionRaw === "IN" || actionRaw === "OUT") ? actionRaw as "IN" | "OUT" : undefined;
        const domainRaw = row[5] ? String(row[5]).trim().toUpperCase() : "";
        const reasonRaw = row[6] ? String(row[6]).trim().toUpperCase() : "";
        const normalizedUid = normalizeUid(String(row[1]));
        const member = getMemberFromUid(normalizedUid);
        const fallbackName = buildFallbackName(normalizedUid);
        const rawName = String(row[0] || "").trim();
        
        const log: TapLog = {
          Name: rawName || member?.name || fallbackName,
          UID: normalizedUid,
          Date: String(row[2]),
          Time: String(row[3]),
          timestamp: parseDateTime(String(row[2]), String(row[3])),
          action,
          domain: normalizeDomain(domainRaw || member?.domain || DEFAULT_DOMAIN),
          reason: reasonRaw
        };
        if (!isNaN(log.timestamp)) results.push(log);
      }
    }
    return results;
  }
  if (typeof data === "string") return parseCSV(data);
  return [];
}

function calculateStreak(datesStr: string[], currentTimeMs: number): number {
  if (datesStr.length === 0) return 0;
  
  // parse dates, get unique midnight timestamps
  const uniqueNumbers = new Set<number>();
  for (const dStr of datesStr) {
    const parts = dStr.includes('/') ? dStr.split('/') : dStr.split('-');
    const year = parts[0].length === 4 ? parts[0] : parts[2];
    const month = parts[0].length === 4 ? parts[1] : parts[1];
    const day = parts[0].length === 4 ? parts[2] : parts[0];
    
    const d = new Date(Number(year), Number(month)-1, Number(day));
    d.setHours(0, 0, 0, 0);
    uniqueNumbers.add(d.getTime());
  }
  
  const midnights = Array.from(uniqueNumbers).sort((a, b) => b - a); // sort descending

  let streak = 0;
  const today = new Date(currentTimeMs);
  today.setHours(0,0,0,0);
  const todayMs = today.getTime();
  const ONE_DAY = 86400000;

  // Streak must be active either today or yesterday
  let currentCheck = todayMs;
  if (midnights[0] === todayMs) {
    // attended today
  } else if (midnights[0] === todayMs - ONE_DAY) {
    // attended yesterday, streak is still alive
    currentCheck = todayMs - ONE_DAY;
  } else {
    // Streak died
    return 0;
  }

  for (const dayMs of midnights) {
    if (dayMs === currentCheck) {
      streak++;
      currentCheck -= ONE_DAY;
    } else {
      break;
    }
  }
  return streak;
}

export function calculateStats(logs: TapLog[], currentTimeMs: number): UserStats[] {
  const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  const userMap = new Map<string, UserStats & { datesVisited: Set<string> }>();

  for (let idx = 0; idx < sortedLogs.length; idx++) {
    const log = sortedLogs[idx];
    if (!userMap.has(log.UID)) {
      userMap.set(log.UID, {
        UID: log.UID, Name: log.Name, Domain: log.domain || DEFAULT_DOMAIN, status: "OUT",
        totalTimeMs: 0, overallTotalTimeMs: 0, lastTapMs: 0, currentStreak: 0,
        datesVisited: new Set()
      });
    }
    const user = userMap.get(log.UID)!;
    if (log.domain) user.Domain = log.domain;
    if (log.Name) user.Name = log.Name;
    user.datesVisited.add(log.Date);

    // Determine intent explicitly from sheet, or fallback to simple toggle
    let action = log.action;
    if (!action) {
      action = user.status === "OUT" ? "IN" : "OUT";
    }

    if (action === "IN") {
      if (user.status === "OUT") {
        user.status = "IN";
        user.lastTapMs = log.timestamp;
      } else {
        // Duplicate IN fallback (sheet auto-fix should usually prevent this).
        if (!hasAutoFixOutNearCurrentIn(sortedLogs, idx, log.UID, log.timestamp)) {
          user.overallTotalTimeMs += FIXED_SESSION_MS;
          user.totalTimeMs += FIXED_SESSION_MS;
        }
        user.lastTapMs = log.timestamp;
      }
    } else if (action === "OUT") {
      if (user.status === "IN") {
        user.status = "OUT";
        const dur = log.timestamp - user.lastTapMs;
        const resolvedDur = resolveSessionDuration(dur, log.reason);
        user.overallTotalTimeMs += resolvedDur;
        user.totalTimeMs += resolvedDur;
      } else {
        // OUT without a prior IN; only count fixed 4h when explicitly marked.
        if (isFixed4HourReason(log.reason)) {
          user.overallTotalTimeMs += FIXED_SESSION_MS;
          user.totalTimeMs += FIXED_SESSION_MS;
        }
      }
    }
  }

  // Apply streak
  for (const user of Array.from(userMap.values())) {
    user.currentStreak = calculateStreak(Array.from(user.datesVisited), currentTimeMs);

    // Safety net: stale open session should not stay IN forever on dashboard.
    if (user.status === "IN") {
      const liveDuration = currentTimeMs - user.lastTapMs;
      if (liveDuration > MAX_VALID_SESSION_MS) {
        user.status = "OUT";
        user.overallTotalTimeMs += FIXED_SESSION_MS;
        user.totalTimeMs += FIXED_SESSION_MS;
      }
    }
  }

  return Array.from(userMap.values());
}

export function formatDuration(ms: number): string {
  if (ms < 0) return "0h 0m";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// Month filter utilities
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getAvailableMonths(logs: TapLog[]): { key: string; label: string }[] {
  const months = new Set<string>();
  for (const log of logs) {
    const d = new Date(log.timestamp);
    if (!isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    }
  }
  return Array.from(months)
    .sort((a, b) => b.localeCompare(a)) // newest first
    .map(key => {
      const [year, month] = key.split('-');
      return { key, label: `${MONTH_NAMES[parseInt(month) - 1]} ${year}` };
    });
}

export function filterLogsByMonth(logs: TapLog[], monthKey: string | null, week: number | null = null): TapLog[] {
  if (!monthKey) return logs; // null = all time
  const [year, month] = monthKey.split('-').map(Number);
  return logs.filter(log => {
    const d = new Date(log.timestamp);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return false;
    
    if (week !== null) {
      const day = d.getDate();
      if (week === 1 && (day < 1 || day > 7)) return false;
      if (week === 2 && (day < 8 || day > 14)) return false;
      if (week === 3 && (day < 15 || day > 21)) return false;
      if (week === 4 && (day < 22 || day > 28)) return false;
      if (week === 5 && day < 29) return false;
    }
    return true;
  });
}

// ──────────────────────────────────────────────
// Session Export Utilities
// ──────────────────────────────────────────────

export function generateSessionCSV(logs: TapLog[]): string {
  const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  const userMap = new Map<string, { status: "IN" | "OUT", lastInLog: TapLog | null }>();
  
  const sessions: Array<{
    name: string;
    date: string;
    inTime: string;
    outTime: string;
    workHours: string;
  }> = [];

  for (let idx = 0; idx < sortedLogs.length; idx++) {
    const log = sortedLogs[idx];
    if (!userMap.has(log.UID)) {
      userMap.set(log.UID, { status: "OUT", lastInLog: null });
    }
    const user = userMap.get(log.UID)!;

    let action = log.action;
    if (!action) {
      action = user.status === "OUT" ? "IN" : "OUT";
    }

    if (action === "IN") {
      if (user.status === "OUT") {
        user.status = "IN";
        user.lastInLog = log;
      } else if (user.lastInLog) {
        // Duplicate IN fallback (sheet auto-fix should usually prevent this).
        if (!hasAutoFixOutNearCurrentIn(sortedLogs, idx, log.UID, log.timestamp)) {
          const autoOutTs = user.lastInLog.timestamp + FIXED_SESSION_MS;
          sessions.push({
            name: user.lastInLog.Name,
            date: user.lastInLog.Date,
            inTime: user.lastInLog.Time,
            outTime: formatTimeFromTimestamp(autoOutTs),
            workHours: formatDuration(FIXED_SESSION_MS)
          });
        }
        user.status = "IN";
        user.lastInLog = log;
      }
    } else if (action === "OUT") {
      if (user.status === "IN" && user.lastInLog) {
        user.status = "OUT";
        const dur = log.timestamp - user.lastInLog.timestamp;
        const resolvedDur = resolveSessionDuration(dur, log.reason);
        const resolvedOutTs = resolvedDur === FIXED_SESSION_MS
          ? user.lastInLog.timestamp + FIXED_SESSION_MS
          : log.timestamp;
        sessions.push({
          name: user.lastInLog.Name,
          date: user.lastInLog.Date,
          inTime: user.lastInLog.Time,
          outTime: formatTimeFromTimestamp(resolvedOutTs),
          workHours: formatDuration(resolvedDur)
        });
      } else {
        if (isFixed4HourReason(log.reason)) {
          // OUT without IN -> backfill a fixed 4h session only when marked.
          const assumedInTs = log.timestamp - FIXED_SESSION_MS;
          sessions.push({
            name: log.Name,
            date: formatDateFromTimestamp(assumedInTs),
            inTime: formatTimeFromTimestamp(assumedInTs),
            outTime: formatTimeFromTimestamp(log.timestamp),
            workHours: formatDuration(FIXED_SESSION_MS)
          });
        }
      }
    }
  }

  const headers = ["Name", "Date", "In Time", "Out Time", "Work Hours"];
  const rows = sessions.map(s => [
    `"${s.name}"`, 
    `"${s.date}"`, 
    `"${s.inTime}"`, 
    `"${s.outTime}"`, 
    `"${s.workHours}"`
  ].join(","));
  
  return [headers.join(","), ...rows].join("\n");
}

function formatTimeFromTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function formatDateFromTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function resolveSessionDuration(durationMs: number, reason?: string): number {
  if (isFixed4HourReason(reason)) return FIXED_SESSION_MS;
  if (durationMs <= 0) return FIXED_SESSION_MS;
  if (durationMs > MAX_VALID_SESSION_MS) return FIXED_SESSION_MS;
  return durationMs;
}

function isFixed4HourReason(reason?: string): boolean {
  const normalized = String(reason || "").toUpperCase();
  return normalized.includes("4H");
}

function hasAutoFixOutNearCurrentIn(
  sortedLogs: TapLog[],
  inIndex: number,
  uid: string,
  timestamp: number
): boolean {
  for (let i = inIndex + 1; i < sortedLogs.length; i++) {
    const next = sortedLogs[i];
    if (next.timestamp > timestamp + 1000) break;
    if (next.UID === uid && next.action === "OUT" && isFixed4HourReason(next.reason)) {
      return true;
    }
  }
  return false;
}

function normalizeDomain(domain: string): string {
  const cleaned = String(domain || "").trim().toUpperCase();
  if (!cleaned) return DEFAULT_DOMAIN;

  const aliasMap: Record<string, string> = {
    SEISED: "SIESED"
  };

  return aliasMap[cleaned] || cleaned;
}

function normalizeUid(uid: string): string {
  const cleaned = String(uid || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";
  return ATTENDANCE_UID_ALIASES[cleaned] || cleaned;
}

function getMemberFromUid(uid: string): AttendanceMember | undefined {
  if (!uid) return undefined;
  return MEMBER_BY_UID.get(uid);
}

function buildFallbackName(uid: string): string {
  if (!uid) return `${DEFAULT_NAME_PREFIX} 0000`;
  const last4 = uid.slice(-4).padStart(4, "0");
  return `${DEFAULT_NAME_PREFIX} ${last4}`;
}
