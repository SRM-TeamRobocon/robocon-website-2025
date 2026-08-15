import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { RECRUIT_SUBDOMAIN_KEYS, isRecruitSubDomain } from "@/lib/recruit-domains";
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

function cutoffKey(sub_domain: string, gender: string) {
  return `${sub_domain}:${gender}`;
}

// POST /api/admin/recruitment/shortlist/compute
// Body (optional): { sub_domain?: string } — scopes the run to a single domain instead of
// all 6. Omit the body (or send `{}`) to run every domain, same as before.
//
// Idempotent and safe to re-run: rows with method = 'manual_override' are left untouched.
// Cutoffs are gender-scoped (originally migration 013) — a domain now needs BOTH a male
// AND a female cutoff set before it runs at all; if either is missing, the whole domain is
// skipped (not just the recruits of the missing gender), same "skip, don't fail the batch"
// behavior as a domain with no cutoff at all had before gender-scoping existed.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // No body (or invalid JSON) — the global "Run Shortlist (All)" button sends nothing.
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
    .select("sub_domain, gender, cutoff_marks")
    .eq("cycle_id", cycleId)
    .in("sub_domain", domainsToRun);

  if (cutoffError) {
    console.error("shortlist compute cutoffs error", cutoffError);
    return NextResponse.json({ success: false, error: "Could not load cutoffs" }, { status: 500 });
  }

  const cutoffMap = new Map(
    (cutoffRows ?? []).map((row: any) => [cutoffKey(row.sub_domain, row.gender), row.cutoff_marks as number])
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
    const maleCutoff = cutoffMap.get(cutoffKey(domain, "male"));
    const femaleCutoff = cutoffMap.get(cutoffKey(domain, "female"));
    if (maleCutoff === undefined || femaleCutoff === undefined) {
      // Either gender's cutoff isn't set for this domain yet — skip the WHOLE domain
      // rather than only the recruits of the missing gender, so a domain never runs
      // half-configured.
      skippedDomains.push(domain);
      continue;
    }

    // Unbounded by a small ID list — a popular domain at the module's 2000-recruit target
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
      { data: genderRows, error: genderError },
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
      selectInChunks<{ id: string; gender: string | null }>(recruitIds, (chunk) =>
        supabase.from("recruit_accounts").select("id, gender").in("id", chunk)
      ),
    ]);

    if (marksError || existingError || genderError) {
      console.error(`shortlist compute marks/existing/gender error (${domain})`, marksError || existingError || genderError);
      return NextResponse.json({ success: false, error: `Could not load marks for ${domain}` }, { status: 500 });
    }

    const marksMap = new Map((marksRows ?? []).map((m: any) => [m.recruit_id, m.marks as number]));
    const existingMap = new Map(
      (existingRows ?? []).map((r: any) => [r.recruit_id, r as { status: string; method: string }])
    );
    const genderMap = new Map((genderRows ?? []).map((r: any) => [r.id, r.gender as string | null]));

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
      // A recruit with no gender on file (registered before migration 013, or an admin
      // cleared it) has no cutoff to compare against — same "can't decide yet" treatment
      // as missing marks, not an error that blocks the rest of the domain.
      const cutoffForGender = gender === "male" ? maleCutoff : gender === "female" ? femaleCutoff : undefined;
      const status =
        marks === undefined || cutoffForGender === undefined
          ? "pending"
          : marks >= cutoffForGender
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
