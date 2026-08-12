/**
 * Seed realistic test data for the recruitment module (active cycle only).
 *
 *   npx tsx --env-file=.env.local scripts/seed-recruitment.ts --yes
 *   npm run seed:recruitment -- --yes
 *
 * DESTRUCTIVE: wipes every recruit_* row belonging to the ACTIVE cycle before
 * inserting, so it is safe to re-run (idempotent) but will destroy real
 * registrations if any exist. Requires an explicit --yes flag.
 *
 * Seeds: recruit_accounts, recruit_domain_selections, recruit_orientation_attendance,
 * recruit_exam_attendance, recruit_marks, recruit_cutoffs.
 * Deliberately leaves shortlist / interview / training tables EMPTY so the admin UI
 * flows (Run Shortlist, panels, QR scanning, result logging) can be exercised by hand.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import {
  RECRUIT_SUBDOMAINS,
  RECRUIT_SUBDOMAIN_KEYS,
  subDomainFullLabel,
  type RecruitSubDomain,
} from "../src/lib/recruit-domains";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TEST_PASSWORD = "Test@1234";
const RECRUIT_COUNT = 60;
const ORIENTATION_RATE = 0.8; // share of all recruits who showed up to orientation
const EXAM_ATTENDANCE_RATE = 0.7; // share of exam-domain recruits who sat the exam
const MARKS_ENTERED_RATE = 0.9; // share of attended (recruit, domain) pairs with marks
const RNG_SEED = 20260808; // fixed → same dataset every run

// Which exam day each domain is written on. Split across both days so day 1 /
// day 2 scanning and the "coding + siesed" two-exam case both get exercised.
const EXAM_DAY_BY_DOMAIN: Record<string, 1 | 2> = {
  coding: 1,
  corporate: 1,
  webdev: 1,
  siesed: 2,
  sambed: 2,
  vfx_gfx: 2,
};

const CUTOFF_BY_DOMAIN: Record<string, number> = {
  coding: 60,
  siesed: 55,
  corporate: 52,
  sambed: 50,
  webdev: 55,
  vfx_gfx: 50,
};

const EVALUATOR_BY_DOMAIN: Record<string, string> = {
  coding: "spaced_lead",
  siesed: "siesed_lead",
  corporate: "mcsocd_lead",
  sambed: "sambed_lead",
  webdev: "spaced_lead",
  vfx_gfx: "mcsocd_lead",
};

const CUTOFF_SET_BY = "robocon_lead";
const SCANNERS = ["vol_aditya", "vol_meenakshi", "vol_rahul", "robocon_lead"];

const DEPARTMENTS = ["CSE", "ECE", "MECH", "IT", "EEE"];
const COURSE = "B.Tech";

// Tables wiped for the active cycle, children first (FK-safe delete order).
const WIPE_ORDER = [
  "recruit_training_attendance",
  "recruit_training_sessions",
  "recruit_interview_results",
  "recruit_interview_tokens",
  "recruit_interview_panels",
  "recruit_shortlist_status",
  "recruit_marks",
  "recruit_cutoffs",
  "recruit_exam_attendance",
  "recruit_orientation_attendance",
  "recruit_domain_selections",
  "recruit_accounts",
];

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) — same seed data on every run
// ---------------------------------------------------------------------------

function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(RNG_SEED);

function pick<T>(items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// Box-Muller — marks cluster around the mean with thin tails, not uniform noise.
function gaussian(mean: number, stdDev: number): number {
  const u = 1 - rng();
  const v = rng();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Name / identity generation
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Aarav", "Ananya", "Aditya", "Diya", "Rohan", "Ishita", "Karthik", "Meenakshi",
  "Vikram", "Sneha", "Arjun", "Priya", "Nikhil", "Divya", "Siddharth", "Kavya",
  "Harish", "Nandini", "Pranav", "Shruti", "Rahul", "Aishwarya", "Varun", "Lakshmi",
  "Abhinav", "Tanvi", "Manish", "Swathi", "Gokul", "Riya", "Yashwanth", "Aparna",
  "Dhruv", "Neha", "Sanjay", "Pooja", "Akash", "Bhavana", "Naveen", "Sanjana",
  "Tarun", "Keerthi", "Vishal", "Anjali", "Surya", "Madhumitha", "Rajesh", "Harini",
  "Kishore", "Vaishnavi", "Ashwin", "Deepika", "Hrithik", "Sahana", "Balaji", "Nithya",
  "Chirag", "Preethi", "Devansh", "Ritika",
];

const LAST_NAMES = [
  "Sharma", "Iyer", "Reddy", "Nair", "Menon", "Verma", "Rao", "Krishnan",
  "Pillai", "Gupta", "Subramanian", "Bansal", "Chowdhury", "Desai", "Joshi", "Kulkarni",
  "Mehta", "Naidu", "Patel", "Ramanathan", "Saxena", "Shetty", "Srinivasan", "Trivedi",
  "Varadarajan", "Agarwal", "Bhat", "Deshpande", "Ganesan", "Hegde",
];

/** RA{batch}11026010{seq} — e.g. RA2211026010042 for a 3rd-year. */
function regNoFor(year: string, index: number): string {
  const batch = year === "1" ? "24" : year === "2" ? "23" : "22";
  return `RA${batch}11026010${String(index + 1).padStart(3, "0")}`;
}

function phone(): string {
  let digits = String(pick([9, 8, 7, 6]));
  for (let i = 0; i < 9; i++) digits += Math.floor(rng() * 10);
  return digits;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Domain selection plan
// ---------------------------------------------------------------------------

/**
 * 15 two-domain recruits (every domain sits an exam for each of its two picks,
 * possibly on different exam days) and 45 single-domain recruits weighted towards
 * coding. Built as an explicit plan rather than random draws so the multi-domain
 * cases the pipeline cares about always exist.
 */
function buildDomainPlan(): RecruitSubDomain[][] {
  const twoDomain: RecruitSubDomain[][] = [
    ["coding", "siesed"],
    ["coding", "corporate"],
    ["siesed", "sambed"],
    ["corporate", "sambed"],
    ["coding", "sambed"],
    ["siesed", "corporate"],
    ["coding", "webdev"],
    ["corporate", "vfx_gfx"],
    ["sambed", "webdev"],
    ["siesed", "vfx_gfx"],
    ["coding", "vfx_gfx"],
    ["corporate", "webdev"],
    ["webdev", "vfx_gfx"],
    ["webdev", "vfx_gfx"],
    ["webdev", "vfx_gfx"],
  ];

  const singleWeights: Array<[RecruitSubDomain, number]> = [
    ["coding", 14],
    ["siesed", 8],
    ["corporate", 7],
    ["sambed", 6],
    ["webdev", 6],
    ["vfx_gfx", 4],
  ];

  const singleDomain: RecruitSubDomain[][] = [];
  singleWeights.forEach(([domain, count]) => {
    for (let i = 0; i < count; i++) singleDomain.push([domain]);
  });

  const plan = shuffle(twoDomain.concat(singleDomain));
  if (plan.length !== RECRUIT_COUNT) {
    throw new Error(`Domain plan produced ${plan.length} entries, expected ${RECRUIT_COUNT}`);
  }
  return plan;
}

// Every recruit provides a LinkedIn URL at registration, regardless of domain.
function linkedinUrlFor(name: string): string {
  return `https://www.linkedin.com/in/${slugify(name)}`;
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function fail(label: string, error: unknown): never {
  console.error(`\n✗ ${label}`);
  console.error(error);
  process.exit(1);
}

async function countRows(supabase: SupabaseClient, table: string, cycleId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", cycleId);
  if (error) fail(`Could not count rows in ${table}`, error);
  return count ?? 0;
}

async function insertRows(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) fail(`Insert into ${table} failed (rows ${i}-${i + CHUNK})`, error);
  }
}

/** True when recruit_exam_attendance has a sub_domain column (schema may add it). */
async function examAttendanceHasSubDomain(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from("recruit_exam_attendance").select("sub_domain").limit(1);
  if (!error) return true;
  const code = (error as { code?: string }).code;
  if (code === "42703" || code === "PGRST204" || /sub_domain/.test(error.message || "")) return false;
  fail("Could not inspect recruit_exam_attendance columns", error);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const confirmed = process.argv.indexOf("--yes") !== -1;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- active cycle -------------------------------------------------------
  const { data: cycles, error: cycleError } = await supabase
    .from("recruitment_cycles")
    .select("id, name, year")
    .eq("is_active", true);
  if (cycleError) fail("Could not read recruitment_cycles", cycleError);
  if (!cycles || cycles.length === 0) {
    fail("No active recruitment cycle", "Create one (is_active = true) before seeding.");
  }
  if (cycles.length > 1) {
    fail("More than one active recruitment cycle", cycles);
  }
  const cycle = cycles[0] as { id: string; name: string; year: string };

  // --- destructive warning -------------------------------------------------
  const existing: Array<[string, number]> = [];
  for (let i = 0; i < WIPE_ORDER.length; i++) {
    existing.push([WIPE_ORDER[i], await countRows(supabase, WIPE_ORDER[i], cycle.id)]);
  }
  const existingTotal = existing.reduce((sum, entry) => sum + entry[1], 0);

  console.log("");
  console.log("========================================================================");
  console.log("  ⚠  DESTRUCTIVE SEED — recruitment module");
  console.log("========================================================================");
  console.log(`  Supabase project : ${url}`);
  console.log(`  Active cycle     : ${cycle.name} (${cycle.year})  [${cycle.id}]`);
  console.log("");
  console.log("  This DELETES ALL recruit_* rows for the active cycle — including any");
  console.log("  REAL registrations, marks, shortlists, panels and training data — and");
  console.log(`  replaces them with ${RECRUIT_COUNT} fake recruits.`);
  console.log("");
  console.log("  Rows that will be deleted:");
  existing.forEach((entry) => {
    console.log(`    ${entry[1] > 0 ? "•" : " "} ${entry[0].padEnd(34)} ${entry[1]}`);
  });
  console.log(`    ${"TOTAL".padEnd(36)} ${existingTotal}`);
  console.log("========================================================================");

  if (!confirmed) {
    console.log("");
    console.log("  Nothing was deleted or inserted — the --yes flag is required.");
    console.log("  Re-run with:");
    console.log("");
    console.log("    npx tsx --env-file=.env.local scripts/seed-recruitment.ts --yes");
    console.log("    (or: npm run seed:recruitment -- --yes)");
    console.log("");
    process.exit(1);
  }

  // --- wipe ---------------------------------------------------------------
  console.log("");
  console.log(`Deleting ${existingTotal} existing row(s) for this cycle...`);
  for (let i = 0; i < WIPE_ORDER.length; i++) {
    const table = WIPE_ORDER[i];
    const { error } = await supabase.from(table).delete().eq("cycle_id", cycle.id);
    if (error) fail(`Delete from ${table} failed`, error);
  }
  console.log("  done.");

  // --- build recruits ------------------------------------------------------
  const domainPlan = buildDomainPlan();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const usedNames: Record<string, true> = {};
  const usedEmails: Record<string, true> = {};

  type SeedRecruit = {
    name: string;
    srm_email: string;
    domains: RecruitSubDomain[];
    row: Record<string, unknown>;
  };

  const recruits: SeedRecruit[] = [];

  for (let i = 0; i < RECRUIT_COUNT; i++) {
    let first = pick(FIRST_NAMES);
    let last = pick(LAST_NAMES);
    let attempts = 0;
    while (usedNames[`${first} ${last}`] && attempts < 200) {
      first = pick(FIRST_NAMES);
      last = pick(LAST_NAMES);
      attempts++;
    }
    const name = `${first} ${last}`;
    usedNames[name] = true;

    // ab1234@srmist.edu.in — initials + a per-recruit number, unique inside the cycle.
    const initials = (first[0] + last[0]).toLowerCase();
    let email = `${initials}${1000 + i * 7}@srmist.edu.in`;
    let bump = 0;
    while (usedEmails[email]) {
      bump++;
      email = `${initials}${1000 + i * 7 + bump}@srmist.edu.in`;
    }
    usedEmails[email] = true;

    const year = pick(["1", "1", "1", "2", "2", "3"]); // skewed towards 1st years
    const domains = domainPlan[i];

    recruits.push({
      name,
      srm_email: email,
      domains,
      row: {
        cycle_id: cycle.id,
        google_uid: null,
        personal_email: `${slugify(name).replace(/-/g, ".")}@gmail.com`,
        srm_email: email,
        srm_email_verified: true,
        name,
        reg_no: regNoFor(year, i),
        year,
        department: pick(DEPARTMENTS),
        course: COURSE,
        phone: phone(),
        portfolio_url: linkedinUrlFor(name),
        password_hash: passwordHash,
        is_selected: false,
      },
    });
  }

  console.log(`Inserting ${recruits.length} recruit_accounts...`);
  const { data: inserted, error: accountsError } = await supabase
    .from("recruit_accounts")
    .insert(recruits.map((r) => r.row))
    .select("id, srm_email");
  if (accountsError || !inserted) fail("Insert into recruit_accounts failed", accountsError);

  const idByEmail: Record<string, string> = {};
  (inserted as Array<{ id: string; srm_email: string }>).forEach((row) => {
    idByEmail[row.srm_email] = row.id;
  });

  // --- domain selections ---------------------------------------------------
  const selectionRows: Record<string, unknown>[] = [];
  recruits.forEach((r) => {
    r.domains.forEach((sub_domain) => {
      selectionRows.push({ cycle_id: cycle.id, recruit_id: idByEmail[r.srm_email], sub_domain });
    });
  });
  console.log(`Inserting ${selectionRows.length} recruit_domain_selections...`);
  await insertRows(supabase, "recruit_domain_selections", selectionRows);

  // --- orientation attendance ---------------------------------------------
  // Sampled by shuffle-then-slice rather than a per-recruit coin flip so the seeded
  // dataset hits the documented rate exactly instead of drifting a few points.
  const orientationRows = shuffle(recruits)
    .slice(0, Math.round(recruits.length * ORIENTATION_RATE))
    .map((r) => ({
      cycle_id: cycle.id,
      recruit_id: idByEmail[r.srm_email],
      scanned_by: pick(SCANNERS),
    }));
  console.log(`Inserting ${orientationRows.length} recruit_orientation_attendance...`);
  await insertRows(supabase, "recruit_orientation_attendance", orientationRows);

  // --- exam attendance -----------------------------------------------------
  const hasExamSubDomain = await examAttendanceHasSubDomain(supabase);
  console.log(
    `recruit_exam_attendance.sub_domain column: ${hasExamSubDomain ? "present (populating it)" : "absent (day-only rows)"}`
  );

  // (recruit, domain) pairs for everyone who actually turned up. A recruit who
  // attends sits the exam for every domain they picked.
  const examAttendees = shuffle(recruits).slice(0, Math.round(recruits.length * EXAM_ATTENDANCE_RATE));
  const attended: Array<{ email: string; domain: RecruitSubDomain; day: 1 | 2 }> = [];
  examAttendees.forEach((r) => {
    r.domains.forEach((domain) => {
      attended.push({ email: r.srm_email, domain, day: EXAM_DAY_BY_DOMAIN[domain] });
    });
  });

  const examRows: Record<string, unknown>[] = [];
  if (hasExamSubDomain) {
    attended.forEach((a) => {
      examRows.push({
        cycle_id: cycle.id,
        recruit_id: idByEmail[a.email],
        day: a.day,
        sub_domain: a.domain,
        scanned_by: pick(SCANNERS),
      });
    });
  } else {
    // unique (recruit_id, cycle_id, day) — collapse a recruit's domains into distinct days.
    const seen: Record<string, true> = {};
    attended.forEach((a) => {
      const key = `${a.email}|${a.day}`;
      if (seen[key]) return;
      seen[key] = true;
      examRows.push({
        cycle_id: cycle.id,
        recruit_id: idByEmail[a.email],
        day: a.day,
        scanned_by: pick(SCANNERS),
      });
    });
  }

  console.log(`Inserting ${examRows.length} recruit_exam_attendance...`);
  const { error: examError } = await supabase.from("recruit_exam_attendance").insert(examRows);
  if (examError) {
    // The table may still carry the old unique (recruit_id, cycle_id, day) even with a
    // sub_domain column — fall back to one row per recruit per day rather than dying.
    if ((examError as { code?: string }).code === "23505" && hasExamSubDomain) {
      console.warn("  unique violation on (recruit_id, cycle_id, day) — retrying with one row per day");
      const seen: Record<string, true> = {};
      const collapsed = examRows.filter((row) => {
        const key = `${row.recruit_id}|${row.day}`;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
      await insertRows(supabase, "recruit_exam_attendance", collapsed);
      console.log(`  inserted ${collapsed.length} collapsed rows instead.`);
    } else {
      fail("Insert into recruit_exam_attendance failed", examError);
    }
  }

  // --- marks ---------------------------------------------------------------
  // Most — not all — attended (recruit, domain) pairs have marks entered, so the
  // shortlist engine also sees "attended but no marks yet" (→ pending) recruits.
  const markRows = shuffle(attended)
    .slice(0, Math.round(attended.length * MARKS_ENTERED_RATE))
    .map((a) => ({
      cycle_id: cycle.id,
      recruit_id: idByEmail[a.email],
      sub_domain: a.domain,
      marks: Math.max(5, Math.min(99, Math.round(gaussian(65, 15)))),
      evaluator_username: EVALUATOR_BY_DOMAIN[a.domain],
    }));
  console.log(`Inserting ${markRows.length} recruit_marks...`);
  await insertRows(supabase, "recruit_marks", markRows);

  // --- cutoffs -------------------------------------------------------------
  const cutoffRows = RECRUIT_SUBDOMAIN_KEYS.map((domain) => ({
    cycle_id: cycle.id,
    sub_domain: domain,
    cutoff_marks: CUTOFF_BY_DOMAIN[domain],
    set_by: CUTOFF_SET_BY,
  }));
  console.log(`Inserting ${cutoffRows.length} recruit_cutoffs...`);
  await insertRows(supabase, "recruit_cutoffs", cutoffRows);

  // --- summary -------------------------------------------------------------
  const domainCounts: Record<string, number> = {};
  RECRUIT_SUBDOMAINS.forEach((d) => {
    domainCounts[d.key] = 0;
  });
  recruits.forEach((r) => r.domains.forEach((d) => (domainCounts[d] += 1)));

  const twoDomainCount = recruits.filter((r) => r.domains.length === 2).length;

  const markValues = markRows.map((row) => row.marks as number);
  const avgMarks = markValues.length
    ? Math.round((markValues.reduce((a, b) => a + b, 0) / markValues.length) * 10) / 10
    : 0;

  console.log("");
  console.log("========================================================================");
  console.log("  ✓ SEED COMPLETE");
  console.log("========================================================================");
  console.log(`  Cycle: ${cycle.name} (${cycle.year})`);
  console.log("");
  console.log("  Rows inserted");
  console.log(`    recruit_accounts               ${(inserted as unknown[]).length}`);
  console.log(`    recruit_domain_selections      ${selectionRows.length}`);
  console.log(`    recruit_orientation_attendance ${orientationRows.length}`);
  console.log(`    recruit_exam_attendance        ${await countRows(supabase, "recruit_exam_attendance", cycle.id)}`);
  console.log(`    recruit_marks                  ${markRows.length}   (avg ${avgMarks} / 100)`);
  console.log(`    recruit_cutoffs                ${cutoffRows.length}`);
  console.log("");
  console.log("  Left EMPTY on purpose (exercise these through the UI):");
  console.log("    recruit_shortlist_status, recruit_interview_panels, recruit_interview_tokens,");
  console.log("    recruit_interview_results, recruit_training_sessions, recruit_training_attendance");
  console.log("");
  console.log("  Domain distribution (recruits per sub-domain)");
  RECRUIT_SUBDOMAINS.forEach((d) => {
    const bar = new Array(domainCounts[d.key] + 1).join("█");
    console.log(`    ${subDomainFullLabel(d.key).padEnd(22)} ${String(domainCounts[d.key]).padStart(2)}  ${bar}`);
  });
  console.log("");
  console.log(`  Two-domain recruits: ${twoDomainCount}`);
  console.log("");
  console.log(`  Cutoffs set: ${RECRUIT_SUBDOMAIN_KEYS.map((d) => `${d}=${CUTOFF_BY_DOMAIN[d]}`).join(", ")}`);
  console.log(`  Exam days:   ${RECRUIT_SUBDOMAIN_KEYS.map((d) => `${d}=day ${EXAM_DAY_BY_DOMAIN[d]}`).join(", ")}`);
  console.log("");
  console.log("  ── Test logins (/recruit/login) ────────────────────────────────────");
  console.log(`  Password for EVERY seeded recruit: ${TEST_PASSWORD}`);
  console.log("");
  sampleLogins(recruits).forEach((line) => console.log(`    ${line}`));
  console.log("========================================================================");
  console.log("");
}

/** A few logins that between them cover single-domain and two-domain recruits. */
function sampleLogins(
  recruits: Array<{ name: string; srm_email: string; domains: RecruitSubDomain[] }>
): string[] {
  const picks: Array<{ name: string; srm_email: string; domains: RecruitSubDomain[] }> = [];
  const add = (r?: { name: string; srm_email: string; domains: RecruitSubDomain[] }) => {
    if (r && picks.indexOf(r) === -1) picks.push(r);
  };

  add(recruits.filter((r) => r.domains.length === 1)[0]);
  add(recruits.filter((r) => r.domains.length === 2)[0]);
  add(recruits.filter((r) => r.domains.length === 2 && r.domains.includes("webdev"))[0]);

  return picks.map((r) => `${r.srm_email.padEnd(26)} ${r.name.padEnd(22)} ${r.domains.join(" + ")}`);
}

main().catch((error) => {
  console.error("\n✗ Seed failed");
  console.error(error);
  process.exit(1);
});
