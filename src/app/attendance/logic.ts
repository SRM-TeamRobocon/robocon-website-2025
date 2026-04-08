import { ATTENDANCE_CONFIG, ATTENDANCE_MEMBERS, ATTENDANCE_UID_ALIASES, AttendanceMember } from "./attendance.config";

export interface TapLog {
  Name: string;
  UID: string;
  Date: string;
  Time: string;
  timestamp: number;
  action?: "IN" | "OUT";
  domain?: string;
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

const MAX_SESSION_MS = ATTENDANCE_CONFIG.MAX_SESSION_HOURS * 60 * 60 * 1000;
const CAPPED_SESSION_MS = ATTENDANCE_CONFIG.CAPPED_SESSION_HOURS * 60 * 60 * 1000;
const DUPLICATE_IN_SESSION_MS = ATTENDANCE_CONFIG.DUPLICATE_IN_HOURS * 60 * 60 * 1000;

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
      
      const log: TapLog = {
        Name: rawName || member?.name || fallbackName,
        UID: normalizedUid,
        Date: values[2],
        Time: values[3],
        timestamp: parseDateTime(values[2], values[3]),
        action,
        domain: rawDomain || member?.domain || ATTENDANCE_CONFIG.DEFAULT_DOMAIN
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
          domain: domainRaw || member?.domain || ATTENDANCE_CONFIG.DEFAULT_DOMAIN
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

  for (const log of sortedLogs) {
    if (!userMap.has(log.UID)) {
      userMap.set(log.UID, {
        UID: log.UID, Name: log.Name, Domain: log.domain || ATTENDANCE_CONFIG.DEFAULT_DOMAIN, status: "OUT",
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
        // Duplicate IN means missing OUT; close previous session with fixed 6h.
        user.overallTotalTimeMs += DUPLICATE_IN_SESSION_MS;
        user.totalTimeMs += DUPLICATE_IN_SESSION_MS;
        user.lastTapMs = log.timestamp;
      }
    } else if (action === "OUT") {
      if (user.status === "IN") {
        user.status = "OUT";
        let dur = log.timestamp - user.lastTapMs;
        
        if (dur > MAX_SESSION_MS) {
          dur = CAPPED_SESSION_MS;
        }

        if (dur > 0) {
          user.overallTotalTimeMs += dur;
          user.totalTimeMs += dur;
        }
      }
    }
  }

  // Final check for anyone currently "IN", and apply streak
  for (const user of Array.from(userMap.values())) {
    user.currentStreak = calculateStreak(Array.from(user.datesVisited), currentTimeMs);
    
    if (user.status === "IN") {
      const dur = currentTimeMs - user.lastTapMs;
      if (dur > MAX_SESSION_MS) {
        // Force checkout them in-memory
        user.status = "OUT";
        user.overallTotalTimeMs += CAPPED_SESSION_MS;
        user.totalTimeMs += CAPPED_SESSION_MS;
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

  for (const log of sortedLogs) {
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
        // Duplicate IN -> auto-close previous session at fixed 6h.
        const autoOutTs = user.lastInLog.timestamp + DUPLICATE_IN_SESSION_MS;
        sessions.push({
          name: user.lastInLog.Name,
          date: user.lastInLog.Date,
          inTime: user.lastInLog.Time,
          outTime: formatTimeFromTimestamp(autoOutTs),
          workHours: formatDuration(DUPLICATE_IN_SESSION_MS)
        });
        user.status = "IN";
        user.lastInLog = log;
      }
    } else if (action === "OUT") {
      if (user.status === "IN" && user.lastInLog) {
        user.status = "OUT";
        let dur = log.timestamp - user.lastInLog.timestamp;
        
        if (dur > MAX_SESSION_MS) {
          dur = CAPPED_SESSION_MS;
        }

        if (dur > 0) {
          sessions.push({
            name: user.lastInLog.Name,
            date: user.lastInLog.Date,
            inTime: user.lastInLog.Time,
            outTime: log.Time,
            workHours: formatDuration(dur)
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
  if (!uid) return `${ATTENDANCE_CONFIG.DEFAULT_NAME_PREFIX} 0000`;
  const last4 = uid.slice(-4).padStart(4, "0");
  return `${ATTENDANCE_CONFIG.DEFAULT_NAME_PREFIX} ${last4}`;
}
