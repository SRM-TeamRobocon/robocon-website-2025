import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain, subDomainFullLabel } from "@/lib/recruit-domains";
import { todayInIST } from "@/lib/recruit-dates";

export const dynamic = "force-dynamic";

// GET  -> list all training sessions for the active recruitment cycle, oldest first.
// POST -> start today's (or a picked date's) attendance for a domain. Body: { sub_domain, session_date? }.
//   sub_domain is one of the 6 recruit_subdomain values, or null/omitted for an all-hands
//   session. This mirrors the QR scanner's training-mode upsert in
//   src/app/api/admin/recruitment/scan/route.ts — a lead "starting attendance" from the
//   dashboard is the same find-or-create-today's-session-for-this-domain operation as a
//   volunteer's first scan of the day, just triggered by hand instead of a scan. The label
//   is always auto-derived (no free-text field) so the two paths can never produce two
//   different sessions for the same (date, domain).
//
// Both require an authenticated lead/admin session (see recruitment.md: all
// /dashboard/recruitment/* admin routes require role "lead" or "admin").
//
// (cycle_id, session_date, sub_domain) is unique as of migration 005 — a double-clicked
// "Start Attendance" resolves to the existing session rather than creating a duplicate that
// would silently drag every recruit's attendance percentage down forever. See ./[id]/route.ts
// for DELETE.

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("recruit_training_sessions")
    .select("id, session_date, session_label, sub_domain, created_at")
    .eq("cycle_id", cycle.id)
    .order("session_date", { ascending: true });

  if (error) {
    console.error("training-sessions GET error", error);
    return NextResponse.json({ success: false, error: "Could not load training sessions" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  // Empty string / undefined / null all mean "all-hands" — matches the scan route's
  // treatment of an omitted sub_domain.
  const rawSubDomain = typeof payload.sub_domain === "string" ? payload.sub_domain.trim() : "";
  if (rawSubDomain && !isRecruitSubDomain(rawSubDomain)) {
    return NextResponse.json({ success: false, error: "Unknown training domain" }, { status: 400 });
  }
  const subDomain = rawSubDomain || null;

  const sessionDate =
    typeof payload.session_date === "string" && payload.session_date.trim() ? payload.session_date.trim() : todayInIST();
  if (Number.isNaN(Date.parse(sessionDate))) {
    return NextResponse.json({ success: false, error: "Invalid session_date" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  const domainLabel = subDomain ? subDomainFullLabel(subDomain) : "All Domains";
  const sessionLabel = `${domainLabel} — ${sessionDate}`;

  const { data, error } = await supabase
    .from("recruit_training_sessions")
    .insert({
      cycle_id: cycle.id,
      session_date: sessionDate,
      sub_domain: subDomain,
      session_label: sessionLabel,
    })
    .select("id, session_date, session_label, sub_domain, created_at")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      // Attendance for this domain today was already started (by this lead, another lead,
      // or a volunteer's QR scan) — hand back the existing session rather than erroring, so
      // "Start Attendance" is idempotent and just opens the day that's already running.
      let existingQuery = supabase
        .from("recruit_training_sessions")
        .select("id, session_date, session_label, sub_domain, created_at")
        .eq("cycle_id", cycle.id)
        .eq("session_date", sessionDate);
      existingQuery = subDomain ? existingQuery.eq("sub_domain", subDomain) : existingQuery.is("sub_domain", null);
      const { data: existing, error: lookupError } = await existingQuery.maybeSingle();

      if (lookupError || !existing) {
        console.error("training-sessions POST lookup-after-conflict error", lookupError);
        return NextResponse.json({ success: false, error: "Could not start attendance" }, { status: 500 });
      }

      return NextResponse.json({ success: true, already_started: true, data: existing });
    }
    console.error("training-sessions POST error", error);
    return NextResponse.json({ success: false, error: "Could not start attendance" }, { status: 500 });
  }

  return NextResponse.json({ success: true, already_started: false, data }, { status: 201 });
}
