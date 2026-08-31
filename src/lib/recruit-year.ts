// Canonical year-of-study list for the recruitment module. Same checked-text-column pattern
// as src/lib/gender.ts — `recruit_accounts.year` and `recruit_cutoffs.year` are both
// `text check (year in ('1','2'))`, not a Postgres enum, so adding a third year later is a
// CHECK change rather than an ALTER TYPE (see supabase/recruit-migration-016-drop-year-3.sql,
// which tightened this back down from ('1','2','3')).
//
// Feeds year-scoped cutoffs on recruit_cutoffs (migration 018): a domain now has FOUR
// cutoffs — one per (gender, year) — because 1st and 2nd years sit different papers.

export const RECRUIT_YEARS = [
  { key: "1", label: "Year 1" },
  { key: "2", label: "Year 2" },
] as const;

export type RecruitYear = (typeof RECRUIT_YEARS)[number]["key"];

export function isRecruitYear(value: unknown): value is RecruitYear {
  return typeof value === "string" && RECRUIT_YEARS.some((y) => y.key === value);
}

export function recruitYearLabel(key: string | null | undefined): string {
  if (!key) return "";
  return RECRUIT_YEARS.find((y) => y.key === key)?.label ?? key;
}
