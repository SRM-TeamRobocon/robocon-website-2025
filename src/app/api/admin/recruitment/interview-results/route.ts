import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain, subDomainFullLabel } from "@/lib/recruit-domains";
import { fetchAllRows, selectInChunks } from "@/lib/supabase/query-helpers";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

const VALID_RESULTS = new Set(["selected", "rejected", "waitlisted"]);

async function getActiveCycleId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// recruit_accounts.is_selected is what puts a recruit on the training roster, lets them scan
// into training sessions, and makes their own dashboard read DEPLOYED. It used to be a
// one-way latch — only ever set to true, never cleared — so a misclicked "Selected" (or a
// result later corrected to rejected) left the recruit permanently marked as selected, with
// manual SQL the only remedy. Recompute it from the data instead: selected iff ANY interview
// result for this recruit in this cycle is 'selected'. Run after EVERY result write, in both
// directions.
async function recomputeIsSelected(supabase: SupabaseClient, recruitId: string, cycleId: string) {
  const { data, error } = await supabase
    .from("recruit_interview_results")
    .select("id")
    .eq("recruit_id", recruitId)
    .eq("cycle_id", cycleId)
    .eq("result", "selected")
    .limit(1);

  if (error) {
    console.error("interview-results: failed to recompute is_selected", error);
    return;
  }

  const isSelected = (data ?? []).length > 0;

  const { error: updateError } = await supabase
    .from("recruit_accounts")
    .update({ is_selected: isSelected })
    .eq("id", recruitId);

  if (updateError) {
    console.error("interview-results: failed to write recruit_accounts.is_selected", updateError);
  }
}

// GET /api/admin/recruitment/interview-results
// Every logged result for the active cycle, joined with the recruit's name / reg_no, newest
// decision first. Without this there was no way to see, review or correct a logged result
// anywhere in the app: logging a result flips the token to `done`, which removes the result
// UI from the panel dashboard entirely.
export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
  }

  // Unbounded by a small ID list — at the module's 2000-recruit target scale, a shortlist
  // stage that interviews a large fraction of applicants can clear PostgREST's default
  // 1000-row response cap on its own.
  const { data: rows, error } = await fetchAllRows<{
    id: string;
    recruit_id: string;
    sub_domain: string;
    result: string;
    notes: string | null;
    is_walkin: boolean;
    interviewer_username: string;
    decided_at: string | null;
  }>((from, to) =>
    supabase
      .from("recruit_interview_results")
      .select("id, recruit_id, sub_domain, result, notes, is_walkin, interviewer_username, decided_at")
      .eq("cycle_id", cycleId)
      .order("decided_at", { ascending: false })
      .range(from, to)
  );

  if (error) {
    console.error("interview-results GET error", error);
    return NextResponse.json({ error: "Could not load interview results" }, { status: 500 });
  }

  const recruitIds = Array.from(new Set(rows.map((r) => r.recruit_id)));
  const recruits = new Map<string, { name: string; reg_no: string }>();

  if (recruitIds.length > 0) {
    const { data: accounts, error: accountsError } = await selectInChunks<{ id: string; name: string; reg_no: string }>(
      recruitIds,
      (chunk) => supabase.from("recruit_accounts").select("id, name, reg_no").in("id", chunk)
    );

    if (accountsError) {
      console.error("interview-results GET accounts error", accountsError);
      return NextResponse.json({ error: "Could not load interview results" }, { status: 500 });
    }

    for (const a of accounts) {
      recruits.set(a.id, { name: a.name, reg_no: a.reg_no });
    }
  }

  const interviewerNames = await resolveDisplayNames(supabase, rows.map((r) => r.interviewer_username));

  const data = rows.map((r) => ({
    id: r.id,
    recruit_id: r.recruit_id,
    name: recruits.get(r.recruit_id)?.name ?? "Unknown",
    reg_no: recruits.get(r.recruit_id)?.reg_no ?? "",
    sub_domain: r.sub_domain,
    result: r.result,
    notes: r.notes,
    is_walkin: Boolean(r.is_walkin),
    interviewer_username: interviewerNames.get(r.interviewer_username) ?? r.interviewer_username,
    decided_at: r.decided_at,
  }));

  return NextResponse.json({ data, cycle_id: cycleId });
}

// POST /api/admin/recruitment/interview-results
// Body per 07-INTERVIEW-MODULE.md: { recruit_id, sub_domain, result, notes?, panel_id? }
//
// Doubles as the EDIT path — the upsert on (recruit_id, sub_domain, cycle_id) overwrites an
// existing decision, and is_selected is recomputed afterwards, so re-posting a corrected
// result fully reverses a mistake (including flipping is_selected back to false).
//
// Judgment call (documented gap in the spec): the doc says step 4 of the server logic must
// "find the recruit_interview_tokens row for this recruit + panel -> set status = 'done'",
// but the documented request body has no panel_id, and a recruit can hold tokens across
// multiple panels (one per domain interview, per 07-INTERVIEW-MODULE.md's "Concurrent
// Panels" section). We own both this route and its callers, so we accept an additional
// `panel_id` field, used ONLY to locate the right recruit_interview_tokens row via
// (recruit_id, panel_id) — it is NOT written to recruit_interview_results, which has no
// panel_id column. The panel dashboard sends the currently-open panel's id; the results
// editor omits it (editing a past decision must not re-touch token state).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const recruit_id = typeof body.recruit_id === "string" ? body.recruit_id : "";
  const sub_domain = typeof body.sub_domain === "string" ? body.sub_domain.trim() : "";
  const result = typeof body.result === "string" ? body.result : "";
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const panel_id = typeof body.panel_id === "string" ? body.panel_id : "";

  if (!recruit_id || !VALID_RESULTS.has(result)) {
    return NextResponse.json(
      { error: "recruit_id and a valid result ('selected' | 'rejected' | 'waitlisted') are required" },
      { status: 400 }
    );
  }

  // Validate against the shared domain config before it reaches the recruit_subdomain enum
  // column, which would otherwise surface as a raw Postgres error with a 500.
  if (!isRecruitSubDomain(sub_domain)) {
    return NextResponse.json({ error: "sub_domain is not a recognised recruitment domain" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
  }

  // Mirrors the marks route: only log a result for a domain the recruit actually applied
  // for. This is the last line of defence behind finding #1 — a result written against a
  // domain the recruit never applied to is always a mistake.
  const { data: selection, error: selectionError } = await supabase
    .from("recruit_domain_selections")
    .select("id")
    .eq("recruit_id", recruit_id)
    .eq("sub_domain", sub_domain)
    .eq("cycle_id", cycleId)
    .maybeSingle();

  if (selectionError) {
    console.error("interview-results: selection lookup error", selectionError);
    return NextResponse.json({ error: "Could not verify domain selection" }, { status: 500 });
  }

  if (!selection) {
    return NextResponse.json(
      { error: `This recruit did not apply for ${subDomainFullLabel(sub_domain)}` },
      { status: 400 }
    );
  }

  // is_walkin is copied from the token, not client-supplied — only known at the moment a
  // panel_id is given (the initial log path). The edit path (results list "Fix" button)
  // omits panel_id, so is_walkin is left out of the payload entirely and the existing
  // value on the row survives the upsert untouched, same reasoning as the token-status
  // update below.
  let isWalkin: boolean | null = null;
  if (panel_id) {
    const { data: tokenRow } = await supabase
      .from("recruit_interview_tokens")
      .select("is_walkin")
      .eq("recruit_id", recruit_id)
      .eq("panel_id", panel_id)
      .maybeSingle();
    isWalkin = tokenRow ? Boolean(tokenRow.is_walkin) : null;
  }

  const upsertPayload: Record<string, unknown> = {
    cycle_id: cycleId,
    recruit_id,
    sub_domain,
    result,
    notes,
    interviewer_username: session.user,
    decided_at: new Date().toISOString(),
  };
  if (isWalkin !== null) {
    upsertPayload.is_walkin = isWalkin;
  }

  const { error: upsertError } = await supabase.from("recruit_interview_results").upsert(upsertPayload, {
    onConflict: "recruit_id,sub_domain,cycle_id",
  });

  if (upsertError) {
    console.error("interview-results: upsert error", upsertError);
    return NextResponse.json({ error: "Could not save the interview result" }, { status: 500 });
  }

  if (panel_id) {
    const { error: tokenError } = await supabase
      .from("recruit_interview_tokens")
      .update({ status: "done" })
      .eq("recruit_id", recruit_id)
      .eq("panel_id", panel_id)
      .in("status", ["waiting", "called"]);

    if (tokenError) {
      // The result itself is already saved — don't fail the whole request over token bookkeeping.
      console.error("interview-results: failed to mark token done", tokenError);
    }
  }

  await recomputeIsSelected(supabase, recruit_id, cycleId);

  return NextResponse.json({ saved: true, recruit_id, sub_domain, result });
}
