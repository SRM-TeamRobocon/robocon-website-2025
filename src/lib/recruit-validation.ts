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
