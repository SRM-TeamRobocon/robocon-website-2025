import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { RECRUIT_SUBDOMAIN_KEYS, isRecruitSubDomain } from "@/lib/recruit-domains";
import { GENDERS } from "@/lib/gender";
import { RECRUIT_YEARS } from "@/lib/recruit-year";
import { fetchAllRows, selectInChunks } from "@/lib/supabase/query-helpers";

export const dynamic = "force-dynamic";

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function cutoffKey(sub_domain: string, gender: string, year: string) {
  return `${sub_domain}:${gender}:${year}`;
}

// POST /api/admin/recruitment/shortlist/compute
// Body (optional): { sub_domain?: string } - scopes the run to a single domain instead of
// all 6. Omit the body (or send `{}`) to run every domain, same as before.
//
// Idempotent and safe to re-run: rows with method = 'manual_override' are left untouched.
// Cutoffs are scoped by BOTH gender (migration 013) and year (migration 018), so a domain
// has four of them - male/year1, male/year2, female/year1, female/year2. A domain needs ALL
// FOUR set before it runs at all; if any is missing the whole domain is skipped (not just
// the recruits of the missing combination), same "skip, don't fail the batch" behavior a
// domain with no cutoff at all had before any of this scoping existed. Running
// half-configured would silently mark a whole year "not_shortlisted" against a cutoff meant
// for the other year, which is far worse than not running.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // No body (or invalid JSON) - the global "Run Shortlist (All)" button sends nothing.
    body = {};
  }

  const scopedDomain = typeof body?.sub_domain === "string" ? body.sub_domain : null;
  if (scopedDomain && !isRecruitSubDomain(scopedDomain)) {
    return NextResponse.json({ success: false, error: "Invalid sub_domain" }, { status: 400 });
  }
  const domainsToRun = scopedDomain ? [scopedDomain] : RECRUIT_SUBDOMAIN_KEYS;

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  const { data: cutoffRows, error: cutoffError } = await supabase
    .from("recruit_cutoffs")
    .select("sub_domain, gender, year, cutoff_marks")
    .eq("cycle_id", cycleId)
    .in("sub_domain", domainsToRun);

  if (cutoffError) {
    console.error("shortlist compute cutoffs error", cutoffError);
    return NextResponse.json({ success: false, error: "Could not load cutoffs" }, { status: 500 });
  }

  // Marks and cutoffs are `numeric(5,2)` (migration 020) read through the UNTYPED recruit
  // client, so PostgREST can hand them back as strings ("72.50") rather than numbers. They
  // are compared with `>=` below, and `"9.5" >= "72.5"` is a lexicographic comparison that
  // is true - it would silently shortlist recruits who failed. Coerce on the way into the
  // Map so every consumer downstream is guaranteed a real number.
  const cutoffMap = new Map(
    (cutoffRows ?? []).map((row: any) => [cutoffKey(row.sub_domain, row.gender, row.year), Number(row.cutoff_marks)])
  );

  const stats = { shortlisted_count: 0, not_shortlisted_count: 0, pending_count: 0 };
  const skippedDomains: string[] = [];
  const nowIso = new Date().toISOString();

  function tally(status: string) {
    if (status === "shortlisted") stats.shortlisted_count += 1;
    else if (status === "not_shortlisted") stats.not_shortlisted_count += 1;
    else stats.pending_count += 1;
  }

  for (const domain of domainsToRun) {
    // All four (gender, year) cutoffs must be present. Derived from GENDERS x RECRUIT_YEARS
    // rather than hardcoded, so adding a third year is a one-line change in recruit-year.ts.
    const missingCutoff = GENDERS.some((g) =>
      RECRUIT_YEARS.some((y) => cutoffMap.get(cutoffKey(domain, g.key, y.key)) === undefined)
    );
    if (missingCutoff) {
      // Some (gender, year) cutoff isn't set for this domain yet - skip the WHOLE domain
      // rather than only the recruits of the missing combination, so a domain never runs
      // half-configured.
      skippedDomains.push(domain);
      continue;
    }

    // Unbounded by a small ID list - a popular domain at the module's 2000-recruit target
    // scale can clear PostgREST's default 1000-row response cap on its own.
    const { data: selections, error: selectionsError } = await fetchAllRows<{ recruit_id: string }>((from, to) =>
      supabase.from("recruit_domain_selections").select("recruit_id").eq("cycle_id", cycleId).eq("sub_domain", domain).range(from, to)
    );

    if (selectionsError) {
      console.error(`shortlist compute selections error (${domain})`, selectionsError);
      return NextResponse.json({ success: false, error: `Could not load recruits for ${domain}` }, { status: 500 });
    }

    const recruitIds = selections.map((s) => s.recruit_id);
    if (recruitIds.length === 0) continue;

    const [
      { data: marksRows, error: marksError },
      { data: existingRows, error: existingError },
      { data: accountRows, error: accountError },
    ] = await Promise.all([
      selectInChunks<{ recruit_id: string; marks: number }>(recruitIds, (chunk) =>
        supabase.from("recruit_marks").select("recruit_id, marks").eq("cycle_id", cycleId).eq("sub_domain", domain).in("recruit_id", chunk)
      ),
      selectInChunks<{ recruit_id: string; status: string; method: string }>(recruitIds, (chunk) =>
        supabase
          .from("recruit_shortlist_status")
          .select("recruit_id, status, method")
          .eq("cycle_id", cycleId)
          .eq("sub_domain", domain)
          .in("recruit_id", chunk)
      ),
      selectInChunks<{ id: string; gender: string | null; year: string | null }>(recruitIds, (chunk) =>
        supabase.from("recruit_accounts").select("id, gender, year").in("id", chunk)
      ),
    ]);

    if (marksError || existingError || accountError) {
      console.error(`shortlist compute marks/existing/account error (${domain})`, marksError || existingError || accountError);
      return NextResponse.json({ success: false, error: `Could not load marks for ${domain}` }, { status: 500 });
    }

    // Same coercion as cutoffMap above - both sides of the `marks >= applicableCutoff`
    // comparison must be real numbers, never numeric strings.
    const marksMap = new Map((marksRows ?? []).map((m: any) => [m.recruit_id, Number(m.marks)]));
    const existingMap = new Map(
      (existingRows ?? []).map((r: any) => [r.recruit_id, r as { status: string; method: string }])
    );
    const genderMap = new Map((accountRows ?? []).map((r: any) => [r.id, r.gender as string | null]));
    const yearMap = new Map((accountRows ?? []).map((r: any) => [r.id, r.year as string | null]));

    const upserts: Array<{
      cycle_id: string;
      recruit_id: string;
      sub_domain: string;
      status: string;
      method: string;
      computed_at: string;
    }> = [];

    for (const recruitId of recruitIds) {
      const existing = existingMap.get(recruitId);

      if (existing?.method === "manual_override") {
        // Leave manual overrides untouched, but still reflect their status in the stats
        // returned to the caller so "Run Shortlist" shows the full current picture.
        tally(existing.status);
        continue;
      }

      const marks = marksMap.get(recruitId);
      const gender = genderMap.get(recruitId);
      const year = yearMap.get(recruitId);
      // A recruit with no gender on file (registered before migration 013, or an admin
      // cleared it) has no cutoff to compare against - same "can't decide yet" treatment
      // as missing marks, not an error that blocks the rest of the domain. `year` is NOT
      // NULL in the schema so it should always resolve, but an unexpected value gets the
      // same treatment rather than being silently compared against the wrong year's bar.
      const applicableCutoff =
        gender && year ? cutoffMap.get(cutoffKey(domain, gender, year)) : undefined;
      const status =
        marks === undefined || applicableCutoff === undefined
          ? "pending"
          : marks >= applicableCutoff
            ? "shortlisted"
            : "not_shortlisted";
      tally(status);

      upserts.push({
        cycle_id: cycleId,
        recruit_id: recruitId,
        sub_domain: domain,
        status,
        method: "auto",
        computed_at: nowIso,
      });
    }

    if (upserts.length > 0) {
      const { error: upsertError } = await supabase
        .from("recruit_shortlist_status")
        .upsert(upserts, { onConflict: "recruit_id,sub_domain,cycle_id" });

      if (upsertError) {
        console.error(`shortlist compute upsert error (${domain})`, upsertError);
        return NextResponse.json({ success: false, error: `Could not save shortlist status for ${domain}` }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ computed: true, stats, skipped_domains: skippedDomains });
}
