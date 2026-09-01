// Shared input validation for recruit-supplied data. Isomorphic — used server-side to
// reject bad input at the boundary, and client-side to guard rendering.

export const MAX_PORTFOLIO_URL_LENGTH = 500;

// Field length caps. Recruit-supplied strings are stored and rendered in the admin
// dashboard; without caps a single registration can bloat every listing query.
export const FIELD_LIMITS = {
  name: 100,
  reg_no: 30,
  department: 60,
  course: 60,
  notes: 1000,
  override_reason: 300,
  domain_label: 50,
  session_label: 100,
  hostel_block: 60,
  hostel_room: 20,
  day_scholar_area: 100,
} as const;

/**
 * Returns the URL only if it is a well-formed http(s) URL within the length cap.
 * Anything else — including `javascript:`, `data:` and `vbscript:` URIs — returns null.
 *
 * This matters because portfolio URLs are rendered as clickable <a href> links in the
 * admin shortlist and interview panels: a `javascript:` URL there would execute in an
 * authenticated lead's session (stored XSS against the dashboard).
 */
export function safeHttpUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_PORTFOLIO_URL_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}

/** Trims and hard-caps a free-text field. Returns "" for non-strings. */
export function boundedText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, max);
}

/**
 * Recruit phone numbers are stored as BARE 10 digits — no country code, no separators —
 * and every write path validates against this. See buildWhatsAppLink in lib/whatsapp.ts,
 * which relies on the same guarantee when prepending "91".
 */
export const PHONE_RE = /^\d{10}$/;

/** Strips everything that isn't a digit. "+91 98765 43210" -> "919876543210". */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

// A search term needs at least this many digits before it's treated as a phone lookup.
// One stray digit in a name search ("k2") would otherwise substring-match hundreds of
// stored numbers and bury the actual result.
const MIN_PHONE_SEARCH_DIGITS = 3;

/**
 * Normalizes a search term for matching against the stored bare-digit phone column, or
 * returns null when it holds too few digits to be a phone lookup.
 *
 * Callers must match name/reg_no against the RAW trimmed term and phone against this one.
 * Someone pasting "+91 98765 43210" or "98765-43210" has to find the row stored as
 * "9876543210", but stripping separators out of a name or reg-no search would break both.
 */
export function phoneSearchTerm(raw: string): string | null {
  let digits = digitsOnly(raw);

  // Stored numbers are exactly 10 bare digits, so a longer term can never match as-is —
  // "+91 98765 43210" would normalize to "919876543210" and find nothing. Peel the two
  // prefixes people actually paste. Guarded on length so it can only ever strip an actual
  // prefix: a genuine 10-digit number starting "91" is 10 long and left alone.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  return digits.length >= MIN_PHONE_SEARCH_DIGITS ? digits : null;
}

// --- Exam marks --------------------------------------------------------------

export const MARKS_MIN = 0;
export const MARKS_MAX = 100;

/** Shared wording so the API, the Marks page and the Cutoffs page all say the same thing. */
export const MARKS_ERROR = "Marks must be between 0 and 100, in steps of 0.5";

/**
 * Exam marks and cutoffs are `numeric(5,2)` (migration 020) but only half marks are ever
 * awarded — 0, 0.5, 1, 1.5 ... 100. The DB has a CHECK enforcing that, and so does this,
 * on purpose: the CHECK is the last line of defence and surfaces as an opaque 500, while
 * this one rejects at the boundary with a message a human can act on, and lets the client
 * catch a typo (72.3) before a round trip. Keep the two rules in sync.
 */
export function isHalfStep(value: number): boolean {
  return Number.isFinite(value) && value * 2 === Math.trunc(value * 2);
}

/**
 * Coerces a marks/cutoff input (number or numeric string) to a valid mark, or null.
 *
 * Null means "reject" — callers must not fall back to 0. Note the recruit_* tables go
 * through an UNTYPED Supabase client, so values read back off a `numeric` column arrive
 * as `any` and may be strings; anything doing arithmetic or a `>=` comparison on them
 * must coerce with Number() first or the comparison silently goes lexicographic.
 */
export function parseMarksValue(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (value < MARKS_MIN || value > MARKS_MAX) return null;
  if (!isHalfStep(value)) return null;
  return value;
}
