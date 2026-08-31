import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { RECRUIT_SUBDOMAIN_KEYS, subDomainLabel } from "@/lib/recruit-domains";
import { fetchAllRows } from "@/lib/supabase/query-helpers";

export const dynamic = "force-dynamic";

// Today's date in IST as YYYY-MM-DD, to compare against the `date`-typed session_date.
// The server may well be running in UTC; the team and the sessions are not.
function todayInIst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Same idea for a timestamptz — which IST calendar day did this happen on. Used for the
// registrations-over-time series, where bucketing by UTC day would shift every sign-up
// between 00:00 and 05:30 IST onto the previous day.
function istDate(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// `department` is free text with no allow-list (see complete-registration/route.ts — it gets
// a trim and a 60-char cap, nothing else), so the raw column holds "ECE" and "Ece" and
// "CSE AIML"/"CSE-AIML"/"CSE AI ML" as separate values. Grouping on the raw string produces
// a meaningless chart, so group on this key and display the most common original spelling
// within each group. Display-only — nothing here writes back to recruit_accounts.
function departmentKey(raw: unknown): string {
  const cleaned = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned || "UNKNOWN";
}

const DEPARTMENT_TOP_N = 15;

type Bucket = { key: string; label: string; count: number; eligible: number };

type YearSplit = { count: number; eligible: number };

// The domain breakdown carries its own year split so the page can show, per domain, how many
// Year 1s and how many Year 2s reached this stage — not just the domain total. The two years
// sit different papers and convert at different rates, so a combined domain number hides the
// thing worth looking at.
type DomainBucket = Bucket & {
  year_1: YearSplit;
  year_2: YearSplit;
  other: YearSplit;
};

type Stage = {
  key: string;
  label: string;
  total: number;
  eligible: number;
  // False for registration, where "eligible" is the same set as "total" and a 100%
  // conversion rate would be noise. The page hides the % column when this is false.
  has_denominator: boolean;
  denominator_label: string;
  by_domain: DomainBucket[];
  by_year: Bucket[];
  by_gender: Bucket[];
  by_residence: Bucket[];
};

// GET /api/admin/recruitment/analytics — funnel stats for the active cycle, overall and
// per sub-domain, plus training attendance % per session. Read-only aggregation across the
// recruit_ tables — no dependency on any other route.
//
// The `stages` block (2026-08-31) is what the tabbed analytics page renders: one entry per
// pipeline stage, each carrying the SAME four breakdowns (domain / year / gender / residence)
// so the page can render any stage with one generic component, plus stage-specific extras
// alongside. Every stage's `eligible` is the previous stage's population, so each stage's
// percentage reads as "conversion from the step before", not "% of everyone".
//
// The older top-level fields (`overall`, `by_domain`, `by_domain_gender`, `by_domain_year`,
// `by_domain_hosteller`, `training`) are unchanged and still returned — the recruitment hub
// page reads `overall`/`by_domain` from here too.
export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id, name, year")
    .eq("is_active", true)
    .single();

  if (!cycle) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  // Every one of these is scoped to the whole cycle rather than a bounded ID list, so at
  // the module's target scale (1000-2000 recruits, most picking 1-2 domains) several of
  // them can exceed PostgREST's default 1000-row response cap. That cap is silent — no
  // error, just the first 1000 rows — so an un-paginated fetch here would make the funnel
  // numbers quietly wrong past that point rather than fail loudly. fetchAllRows pages
  // through with .range() until it sees a short page.
  const [
    accountsRes,
    selectionsRes,
    orientationRes,
    examRes,
    shortlistRes,
    interviewRes,
    sessionsRes,
    trainingAttendanceRes,
    marksRes,
    cutoffsRes,
    tokensRes,
  ] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      supabase
        .from("recruit_accounts")
        .select("id, is_selected, gender, is_hosteller, year, department, created_at, srm_email_verified")
        .eq("cycle_id", cycle.id)
        .range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_domain_selections").select("recruit_id, sub_domain").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_orientation_attendance").select("recruit_id").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_exam_attendance").select("recruit_id, sub_domain, day").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from("recruit_shortlist_status")
        .select("recruit_id, sub_domain, status, method, called_at")
        .eq("cycle_id", cycle.id)
        .range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_interview_results").select("recruit_id, sub_domain, result").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from("recruit_training_sessions")
        .select("id, session_date, session_label")
        .eq("cycle_id", cycle.id)
        .order("session_date", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_training_attendance").select("recruit_id, session_id").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_marks").select("recruit_id, sub_domain, marks").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase.from("recruit_cutoffs").select("sub_domain, gender, cutoff_marks").eq("cycle_id", cycle.id).range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from("recruit_interview_tokens")
        .select("recruit_id, sub_domain, status, is_walkin")
        .eq("cycle_id", cycle.id)
        .range(from, to)
    ),
  ]);

  const firstError =
    accountsRes.error ||
    selectionsRes.error ||
    orientationRes.error ||
    examRes.error ||
    shortlistRes.error ||
    interviewRes.error ||
    sessionsRes.error ||
    trainingAttendanceRes.error ||
    marksRes.error ||
    cutoffsRes.error ||
    tokensRes.error;

  if (firstError) {
    console.error("recruitment analytics error", firstError);
    return NextResponse.json({ success: false, error: "Could not load analytics." }, { status: 500 });
  }

  const accounts = accountsRes.data;
  const domainSelections = selectionsRes.data;
  const shortlist = shortlistRes.data;
  const interviews = interviewRes.data;
  const marks = marksRes.data;
  const cutoffs = cutoffsRes.data;
  const tokens = tokensRes.data;

  const examAttendance = examRes.data;

  const orientationIds = new Set(orientationRes.data.map((row: any) => row.recruit_id));
  const examIds = new Set(examAttendance.map((row: any) => row.recruit_id));
  const interviewedIds = new Set(interviews.map((row: any) => row.recruit_id));
  const shortlistedIds = new Set(
    shortlist.filter((row: any) => row.status === "shortlisted").map((row: any) => row.recruit_id)
  );
  // `selected` is derived from interview results in BOTH the overall and the per-domain
  // block. It used to read recruit_accounts.is_selected here and interview rows there, so
  // the two numbers drifted apart permanently after any post-hoc correction to either side.
  const selectedIds = new Set(
    interviews.filter((row: any) => row.result === "selected").map((row: any) => row.recruit_id)
  );

  // Exam attendance is keyed per sub-domain since migration 001, so it can be attributed to
  // the exam the recruit actually sat. Previously a flat "anyone with an exam row" set was
  // intersected with each domain's applicants, which credited a coding+vfx_gfx student who
  // sat only the coding exam to VFX/GFX too — a stage that domain doesn't even have.
  const examIdsByDomain = new Map<string, Set<string>>();
  for (const row of examAttendance as any[]) {
    if (!row.sub_domain) continue;
    let bucket = examIdsByDomain.get(row.sub_domain);
    if (!bucket) {
      bucket = new Set<string>();
      examIdsByDomain.set(row.sub_domain, bucket);
    }
    bucket.add(row.recruit_id);
  }

  const overall = {
    registered: accounts.length,
    orientation: orientationIds.size,
    exam_attended: examIds.size,
    shortlisted: shortlistedIds.size,
    interviewed: interviewedIds.size,
    selected: selectedIds.size,
  };

  // Interview results carry three outcomes, not just "selected" — rejected/waitlisted were
  // being discarded even though the same `interviews` rows already have them, so this is a
  // client-side tabulation of data already in memory, not a new query.
  const outcomeCounts = (rows: { result: string }[]) => {
    const counts = { selected: 0, rejected: 0, waitlisted: 0 };
    for (const row of rows) {
      if (row.result === "selected") counts.selected += 1;
      else if (row.result === "rejected") counts.rejected += 1;
      else if (row.result === "waitlisted") counts.waitlisted += 1;
    }
    return counts;
  };

  const overallOutcomes = outcomeCounts(interviews as any[]);

  // gender/is_hosteller live on recruit_accounts, not recruit_domain_selections, so a
  // recruit_id -> account lookup is needed to attribute each domain's registrants by these
  // fields. Registered counts only (no funnel breakdown) — same "one row per domain
  // selection" semantics as domainRecruitIds above, so a recruit who picked two domains is
  // counted once per domain, same as everywhere else on this page.
  const accountsById = new Map<string, any>(accounts.map((a: any) => [a.id, a]));

  const byDomainGender = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const domainRecruitIds = domainSelections
      .filter((row: any) => row.sub_domain === domain)
      .map((row: any) => row.recruit_id);
    let male = 0;
    let female = 0;
    let unspecified = 0;
    for (const id of domainRecruitIds) {
      const gender = accountsById.get(id)?.gender;
      if (gender === "male") male += 1;
      else if (gender === "female") female += 1;
      else unspecified += 1;
    }
    return { sub_domain: domain, male, female, unspecified };
  });

  // Year is free text on recruit_accounts ("1"/"2" in practice), so anything that isn't a
  // recognised year falls into `other` rather than being dropped — a silently missing recruit
  // would make this table disagree with the registration counts right above it.
  const byDomainYear = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const domainRecruitIds = domainSelections
      .filter((row: any) => row.sub_domain === domain)
      .map((row: any) => row.recruit_id);
    let year1 = 0;
    let year2 = 0;
    let other = 0;
    for (const id of domainRecruitIds) {
      const year = String(accountsById.get(id)?.year ?? "");
      if (year === "1") year1 += 1;
      else if (year === "2") year2 += 1;
      else other += 1;
    }
    return { sub_domain: domain, year_1: year1, year_2: year2, other };
  });

  const byDomainHosteller = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const domainRecruitIds = domainSelections
      .filter((row: any) => row.sub_domain === domain)
      .map((row: any) => row.recruit_id);
    let hosteller = 0;
    let dayScholar = 0;
    for (const id of domainRecruitIds) {
      if (accountsById.get(id)?.is_hosteller) hosteller += 1;
      else dayScholar += 1;
    }
    return { sub_domain: domain, hosteller, day_scholar: dayScholar };
  });

  const byDomain = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const domainRecruitIds = new Set(
      domainSelections.filter((row: any) => row.sub_domain === domain).map((row: any) => row.recruit_id)
    );
    const domainExamIds = examIdsByDomain.get(domain);

    let orientation = 0;
    let examAttended = 0;
    domainRecruitIds.forEach((id) => {
      if (orientationIds.has(id)) orientation += 1;
      if (domainExamIds?.has(id)) examAttended += 1;
    });

    const shortlistedCount = shortlist.filter(
      (row: any) => row.sub_domain === domain && row.status === "shortlisted"
    ).length;
    const domainInterviews = interviews.filter((row: any) => row.sub_domain === domain) as any[];
    const selectedCount = domainInterviews.filter((row) => row.result === "selected").length;

    return {
      sub_domain: domain,
      registered: domainRecruitIds.size,
      orientation,
      exam_attended: examAttended,
      shortlisted: shortlistedCount,
      interviewed: domainInterviews.length,
      selected: selectedCount,
      interview_outcomes: outcomeCounts(domainInterviews),
    };
  });

  // ---------------------------------------------------------------------------
  // Per-stage blocks for the tabbed analytics page
  // ---------------------------------------------------------------------------

  const allAccountIds = new Set<string>(accounts.map((a: any) => a.id));

  const selectionIdsByDomain = new Map<string, Set<string>>();
  for (const domain of RECRUIT_SUBDOMAIN_KEYS) selectionIdsByDomain.set(domain, new Set());
  for (const row of domainSelections as any[]) {
    selectionIdsByDomain.get(row.sub_domain)?.add(row.recruit_id);
  }

  const idsByDomainFrom = (rows: any[], keep: (row: any) => boolean) => {
    const map = new Map<string, Set<string>>();
    for (const domain of RECRUIT_SUBDOMAIN_KEYS) map.set(domain, new Set());
    for (const row of rows) {
      if (!row.sub_domain || !keep(row)) continue;
      map.get(row.sub_domain)?.add(row.recruit_id);
    }
    return map;
  };

  const intersectByDomain = (base: Map<string, Set<string>>, filter: Set<string>) => {
    const map = new Map<string, Set<string>>();
    base.forEach((ids, domain) => {
      const next = new Set<string>();
      ids.forEach((id) => {
        if (filter.has(id)) next.add(id);
      });
      map.set(domain, next);
    });
    return map;
  };

  const shortlistedIdsByDomain = idsByDomainFrom(shortlist as any[], (r) => r.status === "shortlisted");
  const interviewedIdsByDomain = idsByDomainFrom(interviews as any[], () => true);

  // Counts one dimension of an id-set. `pick` maps an account row to a fixed bucket key, so
  // an unexpected stored value (a year that isn't 1 or 2, a null gender) still lands
  // somewhere countable instead of disappearing and making the buckets disagree with `total`.
  const tally = (ids: Set<string>, pick: (acc: any) => string) => {
    const counts = new Map<string, number>();
    ids.forEach((id) => {
      const key = pick(accountsById.get(id));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  };

  const yearOf = (acc: any) => {
    const y = String(acc?.year ?? "");
    return y === "1" ? "year_1" : y === "2" ? "year_2" : "other";
  };
  const genderOf = (acc: any) =>
    acc?.gender === "male" ? "male" : acc?.gender === "female" ? "female" : "unspecified";
  const residenceOf = (acc: any) => (acc?.is_hosteller ? "hosteller" : "day_scholar");

  const DIMENSIONS = {
    year: {
      pick: yearOf,
      keys: [
        { key: "year_1", label: "Year 1" },
        { key: "year_2", label: "Year 2" },
        { key: "other", label: "Other" },
      ],
    },
    gender: {
      pick: genderOf,
      keys: [
        { key: "male", label: "Male" },
        { key: "female", label: "Female" },
        { key: "unspecified", label: "Unspecified" },
      ],
    },
    residence: {
      pick: residenceOf,
      keys: [
        { key: "hosteller", label: "Hosteller" },
        { key: "day_scholar", label: "Day Scholar" },
      ],
    },
  } as const;

  const dimensionBuckets = (
    dim: keyof typeof DIMENSIONS,
    memberIds: Set<string>,
    eligibleIds: Set<string>
  ): Bucket[] => {
    const { pick, keys } = DIMENSIONS[dim];
    const memberCounts = tally(memberIds, pick);
    const eligibleCounts = tally(eligibleIds, pick);
    return keys.map(({ key, label }) => ({
      key,
      label,
      count: memberCounts.get(key) ?? 0,
      eligible: eligibleCounts.get(key) ?? 0,
    }));
  };

  const buildStage = (
    key: string,
    label: string,
    denominatorLabel: string,
    memberIds: Set<string>,
    eligibleIds: Set<string>,
    memberByDomain: Map<string, Set<string>>,
    eligibleByDomain: Map<string, Set<string>>,
    hasDenominator: boolean
  ): Stage => ({
    key,
    label,
    total: memberIds.size,
    eligible: eligibleIds.size,
    has_denominator: hasDenominator,
    denominator_label: denominatorLabel,
    by_domain: RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
      const members = memberByDomain.get(domain) ?? new Set<string>();
      const eligibles = eligibleByDomain.get(domain) ?? new Set<string>();
      const memberYears = tally(members, yearOf);
      const eligibleYears = tally(eligibles, yearOf);
      const split = (key: string): YearSplit => ({
        count: memberYears.get(key) ?? 0,
        eligible: eligibleYears.get(key) ?? 0,
      });
      return {
        key: domain,
        label: subDomainLabel(domain),
        count: members.size,
        eligible: eligibles.size,
        year_1: split("year_1"),
        year_2: split("year_2"),
        other: split("other"),
      };
    }),
    by_year: dimensionBuckets("year", memberIds, eligibleIds),
    by_gender: dimensionBuckets("gender", memberIds, eligibleIds),
    by_residence: dimensionBuckets("residence", memberIds, eligibleIds),
  });

  // Each stage's denominator is the stage before it, so the percentages read as
  // step-to-step conversion. Registration has none — it IS the denominator.
  const stages: Stage[] = [
    buildStage(
      "registration",
      "Registration",
      "",
      allAccountIds,
      allAccountIds,
      selectionIdsByDomain,
      selectionIdsByDomain,
      false
    ),
    buildStage(
      "orientation",
      "Orientation",
      "registered",
      orientationIds as Set<string>,
      allAccountIds,
      intersectByDomain(selectionIdsByDomain, orientationIds as Set<string>),
      selectionIdsByDomain,
      true
    ),
    buildStage(
      "exam",
      "Exam",
      "registered",
      examIds as Set<string>,
      allAccountIds,
      examIdsByDomain,
      selectionIdsByDomain,
      true
    ),
    buildStage(
      "shortlist",
      "Shortlist",
      "sat the exam",
      shortlistedIds as Set<string>,
      examIds as Set<string>,
      shortlistedIdsByDomain,
      examIdsByDomain,
      true
    ),
    buildStage(
      "interview",
      "Interview",
      "shortlisted",
      interviewedIds as Set<string>,
      shortlistedIds as Set<string>,
      interviewedIdsByDomain,
      shortlistedIdsByDomain,
      true
    ),
  ];

  // --- Registration extras ---------------------------------------------------

  const perDay = new Map<string, number>();
  for (const acc of accounts as any[]) {
    if (!acc.created_at) continue;
    const day = istDate(acc.created_at);
    if (!day) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const registrationsOverTime = Array.from(perDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  // Group on the normalized key but display the most common ORIGINAL spelling in each
  // group, so the chart reads "ECE" rather than a stripped-out key nobody typed.
  const deptGroups = new Map<string, { total: number; spellings: Map<string, number> }>();
  for (const acc of accounts as any[]) {
    const key = departmentKey(acc.department);
    const raw = String(acc.department ?? "").trim() || "Unknown";
    const group = deptGroups.get(key) ?? { total: 0, spellings: new Map<string, number>() };
    group.total += 1;
    group.spellings.set(raw, (group.spellings.get(raw) ?? 0) + 1);
    deptGroups.set(key, group);
  }
  const rankedDepartments = Array.from(deptGroups.values())
    .map((group) => {
      let label = "Unknown";
      let best = -1;
      group.spellings.forEach((n, spelling) => {
        if (n > best) {
          best = n;
          label = spelling;
        }
      });
      return { department: label, count: group.total };
    })
    .sort((a, b) => b.count - a.count);

  const topDepartments = rankedDepartments.slice(0, DEPARTMENT_TOP_N);
  const otherDepartmentCount = rankedDepartments
    .slice(DEPARTMENT_TOP_N)
    .reduce((sum, d) => sum + d.count, 0);

  const emailVerified = accounts.filter((a: any) => a.srm_email_verified).length;

  // --- Exam extras -----------------------------------------------------------

  const examByDay = { day_1: 0, day_2: 0 };
  for (const row of examAttendance as any[]) {
    if (row.day === 1) examByDay.day_1 += 1;
    else if (row.day === 2) examByDay.day_2 += 1;
  }

  // 0-9, 10-19, ... 80-89, 90-100 — the top bucket is 11 wide so a perfect 100 has a home.
  const MARK_BUCKETS = 10;
  const marksHistogram = Array.from({ length: MARK_BUCKETS }, (_, i) => ({
    label: i === MARK_BUCKETS - 1 ? "90-100" : `${i * 10}-${i * 10 + 9}`,
    count: 0,
  }));
  for (const row of marks as any[]) {
    const value = Number(row.marks);
    if (!Number.isFinite(value)) continue;
    const index = Math.min(Math.floor(value / 10), MARK_BUCKETS - 1);
    marksHistogram[index].count += 1;
  }

  // Per-domain Day 1 / Day 2 split. Attendance is unique on (recruit, cycle, sub_domain), so
  // these are sittings — a recruit sitting two domains' exams appears once under each, and
  // `total` per domain equals that domain's distinct attendees.
  const examByDomainDay = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const rows = (examAttendance as any[]).filter((r) => r.sub_domain === domain);
    const day1 = rows.filter((r) => r.day === 1).length;
    const day2 = rows.filter((r) => r.day === 2).length;
    return {
      sub_domain: domain,
      day_1: day1,
      day_2: day2,
      // Not day1 + day2: a row with an unexpected `day` would otherwise vanish from the total.
      total: rows.length,
    };
  });

  const marksByDomain = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const rows = (marks as any[]).filter((m) => m.sub_domain === domain);
    if (rows.length === 0) {
      return { sub_domain: domain, entered: 0, average: null, min: null, max: null };
    }
    const values = rows.map((m) => Number(m.marks)).filter((v) => Number.isFinite(v));
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      sub_domain: domain,
      entered: rows.length,
      average: values.length > 0 ? Math.round((sum / values.length) * 10) / 10 : null,
      min: values.length > 0 ? Math.min(...values) : null,
      max: values.length > 0 ? Math.max(...values) : null,
    };
  });

  // --- Shortlist extras ------------------------------------------------------

  const shortlistStatusByDomain = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const rows = (shortlist as any[]).filter((r) => r.sub_domain === domain);
    return {
      sub_domain: domain,
      pending: rows.filter((r) => r.status === "pending").length,
      shortlisted: rows.filter((r) => r.status === "shortlisted").length,
      not_shortlisted: rows.filter((r) => r.status === "not_shortlisted").length,
    };
  });

  // Cutoffs are gender-scoped since migration 013, and shortlist/compute skips a domain
  // entirely unless BOTH genders have one set — so a null here is the reason a domain shows
  // zero shortlisted, and is worth surfacing rather than rendering as a blank cell.
  const cutoffByDomain = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const rows = (cutoffs as any[]).filter((c) => c.sub_domain === domain);
    const forGender = (g: string) => {
      const row = rows.find((c) => c.gender === g);
      return row ? Number(row.cutoff_marks) : null;
    };
    return { sub_domain: domain, male: forGender("male"), female: forGender("female") };
  });

  const shortlistedByGender = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const ids = shortlistedIdsByDomain.get(domain) ?? new Set<string>();
    const counts = tally(ids, genderOf);
    return {
      sub_domain: domain,
      male: counts.get("male") ?? 0,
      female: counts.get("female") ?? 0,
      unspecified: counts.get("unspecified") ?? 0,
    };
  });

  const shortlistMethod = {
    auto: (shortlist as any[]).filter((r) => r.method !== "manual").length,
    manual: (shortlist as any[]).filter((r) => r.method === "manual").length,
  };
  const shortlistCalled = (shortlist as any[]).filter((r) => r.called_at).length;

  // --- Interview extras ------------------------------------------------------

  const tokenStatus = { waiting: 0, called: 0, done: 0, no_show: 0, deferred: 0 };
  let walkinTokens = 0;
  for (const row of tokens as any[]) {
    if (row.status in tokenStatus) tokenStatus[row.status as keyof typeof tokenStatus] += 1;
    if (row.is_walkin) walkinTokens += 1;
  }
  const checkedInIds = new Set((tokens as any[]).map((t) => t.recruit_id));
  const resolvedTokens = tokenStatus.done + tokenStatus.no_show;
  const noShowRate =
    resolvedTokens > 0 ? Math.round((tokenStatus.no_show / resolvedTokens) * 1000) / 10 : null;

  const sessions = sessionsRes.data;
  const trainingAttendance = trainingAttendanceRes.data;

  // Training rosters key off recruit_accounts.is_selected — that is the flag the training
  // QR scanner and /api/admin/recruitment/training-attendance both gate on, so the
  // denominator here has to match it rather than the interview-result set used above.
  const trainingRosterIds = new Set(accounts.filter((a: any) => a.is_selected).map((a: any) => a.id));
  // Fall back to "anyone who ever showed up in any session" if no one has been flagged
  // selected yet (e.g. analytics viewed before the interview stage runs).
  const totalTrainees =
    trainingRosterIds.size > 0
      ? trainingRosterIds.size
      : new Set(trainingAttendance.map((row: any) => row.recruit_id)).size;

  // Sessions that have not happened yet are reported but excluded from every aggregate —
  // a lead who pre-creates a whole 3-week programme should not see the average collapse.
  const today = todayInIst();
  const sessionStats = sessions.map((s: any) => {
    const hasOccurred = String(s.session_date).slice(0, 10) <= today;
    const presentCount = trainingAttendance.filter((row: any) => row.session_id === s.id).length;
    const attendancePct = totalTrainees > 0 ? Math.round((presentCount / totalTrainees) * 1000) / 10 : 0;
    return {
      id: s.id,
      session_date: s.session_date,
      session_label: s.session_label,
      present_count: presentCount,
      attendance_pct: hasOccurred ? attendancePct : null,
      has_occurred: hasOccurred,
    };
  });

  const heldSessions = sessionStats.filter((s) => s.has_occurred);
  const averageAttendancePct =
    heldSessions.length > 0
      ? Math.round(
          (heldSessions.reduce((sum, s) => sum + (s.attendance_pct ?? 0), 0) / heldSessions.length) * 10
        ) / 10
      : 0;

  return NextResponse.json({
    success: true,
    cycle,
    overall: { ...overall, interview_outcomes: overallOutcomes },
    by_domain: byDomain,
    by_domain_gender: byDomainGender,
    by_domain_year: byDomainYear,
    by_domain_hosteller: byDomainHosteller,
    stages,
    stage_extras: {
      registration: {
        over_time: registrationsOverTime,
        departments: topDepartments,
        other_departments: otherDepartmentCount,
        distinct_departments: rankedDepartments.length,
        email_verified: emailVerified,
        email_unverified: accounts.length - emailVerified,
      },
      exam: {
        by_day: examByDay,
        by_domain_day: examByDomainDay,
        sittings: examAttendance.length,
        marks_entered: marks.length,
        marks_histogram: marksHistogram,
        marks_by_domain: marksByDomain,
      },
      shortlist: {
        status_by_domain: shortlistStatusByDomain,
        cutoffs: cutoffByDomain,
        shortlisted_by_gender: shortlistedByGender,
        method: shortlistMethod,
        called: shortlistCalled,
        evaluated: shortlist.length,
      },
      interview: {
        token_status: tokenStatus,
        checked_in: checkedInIds.size,
        walkin_tokens: walkinTokens,
        no_show_rate: noShowRate,
        outcomes: overallOutcomes,
        outcomes_by_domain: byDomain.map((d) => ({
          sub_domain: d.sub_domain,
          ...d.interview_outcomes,
        })),
      },
    },
    training: {
      total_trainees: totalTrainees,
      sessions: sessionStats,
      held_sessions: heldSessions.length,
      total_sessions_created: sessionStats.length,
      average_attendance_pct: averageAttendancePct,
    },
  });
}
