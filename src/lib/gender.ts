// Canonical gender list for the recruitment module. Same checked-text-column pattern as
// src/lib/travel-method.ts (see supabase/recruit-migration-013-gender-cutoffs.sql for why
// this is a checked text column rather than a Postgres enum). Feeds gender-scoped cutoffs
// on recruit_cutoffs - every domain now has a separate male and female cutoff.

export const GENDERS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
] as const;

export type Gender = (typeof GENDERS)[number]["key"];

export function isGender(value: unknown): value is Gender {
  return typeof value === "string" && GENDERS.some((g) => g.key === value);
}

export function genderLabel(key: string | null | undefined): string {
  if (!key) return "";
  return GENDERS.find((g) => g.key === key)?.label ?? key;
}
