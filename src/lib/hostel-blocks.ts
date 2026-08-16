// Canonical SRM hostel block list for the recruitment module.
//
// Mirrors the block options in the workshop registration form
// (src/app/workshopReg2/page.tsx), which is where this list has been maintained. The
// one difference: that form folds "Day Scholar" into the same dropdown as a sentinel
// value, whereas recruitment asks "are you a hosteller?" as a separate boolean first —
// so this list holds real blocks only and never a day-scholar entry.
//
// Kept as plain text rather than a Postgres enum because the list changes between
// intakes; see supabase/recruit-migration-004-hostel.sql for that reasoning.

export const HOSTEL_BLOCKS = [
  "N Block",
  "Kaari",
  "Paari",
  "Oori",
  "Adhyaman",
  "Nelson Mandela",
  "Sannasi A",
  "Sannasi C",
  "Agasthyar",
  "Malligai",
  "Mullai",
  "Manoranjitham",
  "Thamarai",
  "KC",
  "EsQ",
  "M Block",
  "Meenakshi",
  "Began",
  "NRI",
  "PF",
  "APJ Abdul Kalam",
  "Green Peqrl",
  "Senbagam",
  "others",

] as const;

export type HostelBlock = (typeof HOSTEL_BLOCKS)[number];

export function isHostelBlock(value: unknown): value is HostelBlock {
  return typeof value === "string" && (HOSTEL_BLOCKS as readonly string[]).includes(value);
}
