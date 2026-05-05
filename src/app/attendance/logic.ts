export interface AttendanceMember {
  uid: string;
  name: string;
  domain: string;
}

const DEFAULT_DOMAIN = "GENERAL";
const DEFAULT_NAME_PREFIX = "Member";
const FIXED_SESSION_MS = 4 * 60 * 60 * 1000;        // 4 hours – used for duplicate INs
const MAX_SESSION_MS    = 30 * 60 * 60 * 1000;       // 30 hours – cap for absurdly long sessions

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
  { uid: "99A06661", name: "Agamjot Kaur", domain: "SIESED" },
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

export interface ParseDiagnostics {
  totalRows: number;
  parsedRows: number;
  skippedRows: number;
  skippedSamples: string[];
  headerDetected: boolean;
}

export interface ParseAttendanceResult {
  logs: TapLog[];
  diagnostics: ParseDiagnostics;
}

const MEMBER_BY_UID = new Map<string, AttendanceMember>(
  ATTENDANCE_MEMBERS.map((m) => [normalizeUid(m.uid), m])
);

const MAX_SKIP_SAMPLES = 5;

type DateParts = { year: number; month: number; day: number };
type TimeParts = { hours: number; minutes: number; seconds: number };

export function parseCSV(csvString: string): ParseAttendanceResult {
  if (!csvString || csvString.trim() === "") {
    return buildParseResult([], 0, 0, [], false);
  }

  const rows = csvString
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "")
    .map(splitCsvLine);

  return parseRows(rows);
}

function parseDateTime(dateStr: string, timeStr: string): number {
  const date = parseDateParts(dateStr);
  const time = parseTimeParts(timeStr);
  if (!date || !time) return NaN;

  const dt = new Date(
    date.year,
    date.month - 1,
    date.day,
    time.hours,
    time.minutes,
    time.seconds,
    0
  );

  if (
    dt.getFullYear() !== date.year ||
    dt.getMonth() + 1 !== date.month ||
    dt.getDate() !== date.day ||
    dt.getHours() !== time.hours ||
    dt.getMinutes() !== time.minutes ||
    dt.getSeconds() !== time.seconds
  ) {
    return NaN;
  }

  return dt.getTime();
}

export function parseData(data: any): ParseAttendanceResult {
  if (Array.isArray(data)) {
    const rows = data.map((row) =>
      Array.isArray(row)
        ? row.map((value) => String(value ?? "").trim())
        : [String(row ?? "").trim()]
    );
    return parseRows(rows);
  }
  if (typeof data === "string") return parseCSV(data);
  return buildParseResult([], 0, 0, [], false);
}

function parseRows(rows: string[][]): ParseAttendanceResult {
  if (rows.length === 0) {
    return buildParseResult([], 0, 0, [], false);
  }

  const headerDetected = isLikelyHeaderRow(rows[0]);
  const startIndex = headerDetected ? 1 : 0;

  const logs: TapLog[] = [];
  const skippedSamples: string[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i].map((cell) => String(cell ?? "").trim());
    if (row.length === 0 || row.every((cell) => cell === "")) {
      continue;
    }

    totalRows++;
    if (row.length < 4) {
      skippedRows++;
      pushSkipSample(skippedSamples, i + 1, "Missing required columns");
      continue;
    }

    const rawUid = row[1] || "";
    const normalizedUid = normalizeUid(rawUid);
    if (!normalizedUid) {
      skippedRows++;
      pushSkipSample(skippedSamples, i + 1, "Missing/invalid UID");
      continue;
    }

    const rawDate = row[2] || "";
    const rawTime = row[3] || "";
    const timestamp = parseDateTime(rawDate, rawTime);
    if (Number.isNaN(timestamp)) {
      skippedRows++;
      pushSkipSample(
        skippedSamples,
        i + 1,
        `Unparseable date/time (${rawDate} ${rawTime})`
      );
      continue;
    }

    const actionRaw = row[4] ? row[4].toUpperCase() : "";
    const action = actionRaw === "IN" || actionRaw === "OUT"
      ? (actionRaw as "IN" | "OUT")
      : undefined;

    const domainRaw = row[5] ? row[5].toUpperCase() : "";
    const reasonRaw = row[6] ? row[6].toUpperCase() : "";

    const member = getMemberFromUid(normalizedUid);
    const fallbackName = buildFallbackName(normalizedUid);
    const rawName = row[0] ? row[0].trim() : "";

    logs.push({
      Name: rawName || member?.name || fallbackName,
      UID: normalizedUid,
      Date: rawDate,
      Time: rawTime,
      timestamp,
      action,
      domain: normalizeDomain(domainRaw || member?.domain || DEFAULT_DOMAIN),
      reason: reasonRaw,
    });
  }

  return buildParseResult(logs, totalRows, skippedRows, skippedSamples, headerDetected);
}

function parseDateParts(rawDate: string): DateParts | null {
  const cleaned = String(rawDate || "").trim();
  if (!cleaned) return null;

  const delimiter = cleaned.includes("/") ? "/" : cleaned.includes("-") ? "-" : "";
  if (!delimiter) return null;

  const parts = cleaned.split(delimiter).map((part) => part.trim());
  if (parts.length !== 3) return null;

  const numbers = parts.map((part) => Number.parseInt(part, 10));
  if (numbers.some((part) => Number.isNaN(part))) return null;

  const [a, b, c] = numbers;
  const firstPart = parts[0];
  const thirdPart = parts[2];

  // YYYY-MM-DD or YYYY/MM/DD
  if (firstPart.length === 4) {
    const candidate = { year: a, month: b, day: c };
    return isValidDateParts(candidate) ? candidate : null;
  }

  // DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  if (thirdPart.length === 4) {
    const dayFirst = { year: c, month: b, day: a };
    const monthFirst = { year: c, month: a, day: b };
    const dayFirstValid = isValidDateParts(dayFirst);
    const monthFirstValid = isValidDateParts(monthFirst);

    if (a > 12 && dayFirstValid) return dayFirst;
    if (b > 12 && monthFirstValid) return monthFirst;
    if (delimiter === "-" && dayFirstValid) return dayFirst;
    if (dayFirstValid && !monthFirstValid) return dayFirst;
    if (monthFirstValid && !dayFirstValid) return monthFirst;
    if (dayFirstValid && monthFirstValid) return dayFirst;
  }

  return null;
}

function parseTimeParts(rawTime: string): TimeParts | null {
  const cleaned = String(rawTime || "")
    .trim()
    .replace(/\./g, ":")
    .replace(/\s+/g, " ")
    .toUpperCase();

  if (!cleaned) return null;

  const match = cleaned.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] || "0", 10);
  const seconds = Number.parseInt(match[3] || "0", 10);
  const meridiem = match[4];

  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  if (minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
  } else if (hours < 0 || hours > 23) {
    return null;
  }

  return { hours, minutes, seconds };
}

function isValidDateParts(parts: DateParts): boolean {
  const { year, month, day } = parts;
  if (year < 1900 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() + 1 === month &&
    d.getDate() === day
  );
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isLikelyHeaderRow(row: string[]): boolean {
  const normalized = row.map((cell) =>
    String(cell || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  );

  const nameCol = normalized[0] || "";
  const uidCol = normalized[1] || "";
  const dateCol = normalized[2] || "";
  const timeCol = normalized[3] || "";
  const statusCol = normalized[4] || "";

  const hasNameHeader =
    nameCol.includes("NAME") ||
    nameCol.includes("MEMBER") ||
    nameCol.includes("STUDENT");
  const hasUidHeader = uidCol.includes("UID") || uidCol.includes("CARD");
  const hasDateHeader = dateCol.includes("DATE");
  const hasTimeHeader = timeCol.includes("TIME");
  const hasStatusHeader =
    statusCol.includes("STATUS") ||
    statusCol.includes("ACTION") ||
    statusCol.includes("INOUT");

  return (hasNameHeader && hasUidHeader) || (hasDateHeader && hasTimeHeader) || hasStatusHeader;
}

function pushSkipSample(samples: string[], rowNumber: number, reason: string): void {
  if (samples.length >= MAX_SKIP_SAMPLES) return;
  samples.push(`Row ${rowNumber}: ${reason}`);
}

function buildParseResult(
  logs: TapLog[],
  totalRows: number,
  skippedRows: number,
  skippedSamples: string[],
  headerDetected: boolean
): ParseAttendanceResult {
  return {
    logs,
    diagnostics: {
      totalRows,
      parsedRows: logs.length,
      skippedRows,
      skippedSamples,
      headerDetected,
    },
  };
}

function calculateStreak(datesStr: string[], currentTimeMs: number): number {
  if (datesStr.length === 0) return 0;
  
  // parse dates, get unique midnight timestamps
  const uniqueNumbers = new Set<number>();
  for (const dStr of datesStr) {
    const parsed = parseDateParts(dStr);
    if (!parsed) continue;

    const d = new Date(parsed.year, parsed.month - 1, parsed.day);
    d.setHours(0, 0, 0, 0);
    uniqueNumbers.add(d.getTime());
  }

  if (uniqueNumbers.size === 0) return 0;
  
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

    let action = log.action;
    
    if (!action) {
      user.overallTotalTimeMs += 60 * 60 * 1000;
      user.totalTimeMs += 60 * 60 * 1000;
      user.status = "OUT";
      continue;
    }

    if (action === "IN") {
      if (user.status === "OUT") {
        user.status = "IN";
        user.lastTapMs = log.timestamp;
      } else {
        user.overallTotalTimeMs += FIXED_SESSION_MS;
        user.totalTimeMs += FIXED_SESSION_MS;
        user.lastTapMs = log.timestamp;
      }
    } else if (action === "OUT") {
      if (user.status === "IN") {
        user.status = "OUT";
        const dur = log.timestamp - user.lastTapMs;
        // Cap absurdly long sessions (> 30h) to 4 hours
        const cappedDur = dur > MAX_SESSION_MS ? FIXED_SESSION_MS : dur;
        user.overallTotalTimeMs += cappedDur;
        user.totalTimeMs += cappedDur;
      } else {
        user.overallTotalTimeMs += 60 * 60 * 1000;
        user.totalTimeMs += 60 * 60 * 1000;
      }
    }
  }

  // Apply streak
  for (const user of Array.from(userMap.values())) {
    user.currentStreak = calculateStreak(Array.from(user.datesVisited), currentTimeMs);
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
      sessions.push({
        name: log.Name,
        date: log.Date,
        inTime: log.Time,
        outTime: formatTimeFromTimestamp(log.timestamp + 60 * 60 * 1000),
        workHours: formatDuration(60 * 60 * 1000)
      });
      user.status = "OUT";
      user.lastInLog = null;
      continue;
    }

    if (action === "IN") {
      if (user.status === "OUT") {
        user.status = "IN";
        user.lastInLog = log;
      } else if (user.lastInLog) {
        const autoOutTs = user.lastInLog.timestamp + FIXED_SESSION_MS;
        sessions.push({
          name: user.lastInLog.Name,
          date: user.lastInLog.Date,
          inTime: user.lastInLog.Time,
          outTime: formatTimeFromTimestamp(autoOutTs),
          workHours: formatDuration(FIXED_SESSION_MS)
        });
        user.status = "IN";
        user.lastInLog = log;
      }
    } else if (action === "OUT") {
      if (user.status === "IN" && user.lastInLog) {
        user.status = "OUT";
        const dur = log.timestamp - user.lastInLog.timestamp;
        // Cap absurdly long sessions (> 30h) to 4 hours
        const cappedDur = dur > MAX_SESSION_MS ? FIXED_SESSION_MS : dur;
        sessions.push({
          name: user.lastInLog.Name,
          date: user.lastInLog.Date,
          inTime: user.lastInLog.Time,
          outTime: dur > MAX_SESSION_MS ? formatTimeFromTimestamp(user.lastInLog.timestamp + FIXED_SESSION_MS) : log.Time,
          workHours: formatDuration(cappedDur)
        });
        user.lastInLog = null;
      } else {
        const assumedInTs = log.timestamp - 60 * 60 * 1000;
        sessions.push({
          name: log.Name,
          date: formatDateFromTimestamp(assumedInTs),
          inTime: formatTimeFromTimestamp(assumedInTs),
          outTime: log.Time,
          workHours: formatDuration(60 * 60 * 1000)
        });
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
