import type { SupabaseClient } from "@supabase/supabase-js";

// Formerly the 5 domain leads (spacedlead/roboconlead/siesedlead/mcsocdlead/sambedlead) —
// removed now that they've moved to mentor status, so they no longer surface as leads
// anywhere in the dashboard (topbar name, "who's free" timetable roster, recruitment
// "done by" attribution). Their LEAD_ACCOUNTS login credentials are a separate env-var
// concern (not this map) and were left untouched.
export const ADMIN_USERNAME_MAP: Record<string, string> = {};

function normalizeUsernameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const NORMALIZED_ADMIN_USERNAME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ADMIN_USERNAME_MAP).map(([key, name]) => [normalizeUsernameKey(key), name])
);

export function displayNameForUsername(username: string | undefined | null) {
  if (!username) return "Member";
  return ADMIN_USERNAME_MAP[username] || username;
}

// Recruitment tables store the raw JWT `user` claim in "done by" columns (scanned_by,
// evaluator_username, interviewer_username, set_by, marked_by, ...) — a short LEAD_ACCOUNTS
// username for env-based staff logins, or a member's email for member_accounts logins. Server
// only: resolves a batch of those raw values to display names for the recruitment dashboard,
// falling back to the raw value when nothing matches (e.g. a deleted member account).
export async function resolveDisplayNames(
  supabase: SupabaseClient,
  values: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(values.filter((v): v is string => Boolean(v))));
  const result = new Map<string, string>();
  const unresolved: string[] = [];

  for (const value of unique) {
    // Matched loosely (case/underscore-insensitive): seed/legacy data writes evaluator
    // identifiers like "spaced_lead" for the same person LEAD_ACCOUNTS logs in as "spacedlead".
    const mapped = ADMIN_USERNAME_MAP[value] || NORMALIZED_ADMIN_USERNAME_MAP[normalizeUsernameKey(value)];
    if (mapped) {
      result.set(value, mapped);
    } else {
      unresolved.push(value);
    }
  }

  if (unresolved.length > 0) {
    const { data } = await supabase.from("member_accounts").select("email, name").in("email", unresolved);
    for (const row of (data ?? []) as { email: string; name: string }[]) {
      result.set(row.email, row.name);
    }
  }

  for (const value of unique) {
    if (!result.has(value)) result.set(value, value);
  }

  return result;
}
