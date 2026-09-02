// Canonical day-scholar travel method list for the recruitment module. Day-scholar-only
// counterpart to src/lib/hostel-blocks.ts, following the same pattern - see
// supabase/recruit-migration-012-day-scholar-details.sql for why this is a checked text
// column rather than a Postgres enum (a third option can be added later with no ALTER TYPE).

export const TRAVEL_METHODS = [
  { key: "own_vehicle", label: "Own Vehicle" },
  { key: "college_bus", label: "College Bus" },
] as const;

export type TravelMethod = (typeof TRAVEL_METHODS)[number]["key"];

export function isTravelMethod(value: unknown): value is TravelMethod {
  return typeof value === "string" && TRAVEL_METHODS.some((m) => m.key === value);
}

export function travelMethodLabel(key: string | null | undefined): string {
  if (!key) return "";
  return TRAVEL_METHODS.find((m) => m.key === key)?.label ?? key;
}
