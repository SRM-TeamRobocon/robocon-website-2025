import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain, subDomainFullLabel } from "@/lib/recruit-domains";
import { FIELD_LIMITS, boundedText } from "@/lib/recruit-validation";

export const dynamic = "force-dynamic";

// Explicit column list — never `select("*")`. New columns added to
// recruit_interview_panels should be opted into here deliberately rather than
// leaking to every caller (including role "member") the moment they're created.
const PANEL_COLUMNS = "id, cycle_id, domain_label, sub_domain, table_number, is_active, created_at, created_by";

// Postgres unique_violation.
const UNIQUE_VIOLATION = "23505";
const MAX_TABLE_NUMBER_ATTEMPTS = 5;

async function getActiveCycleId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/panels[?active=true]
// Read access is intentionally broader than lead/admin: the recruit-scanner's "Interview
// Check-In" mode needs any volunteer (role "member") to be able to list active panels for
// its picker dropdown, and the live queue display page reads this list to resolve a panel's
// domain_label. Members get a reduced projection (no created_by / cycle_id) — see the
// queue route for the same role-branching rationale.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isStaff = session.role === "lead" || session.role === "admin";

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
  }

  const activeOnly = request.nextUrl.searchParams.get("active") === "true";

  let query = supabase
    .from("recruit_interview_panels")
    .select(PANEL_COLUMNS)
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: true });

  if (activeOnly) query = query.eq("is_active", true);

  const { data: panels, error } = await query;
  if (error) {
    console.error("recruitment panels GET error", error);
    return NextResponse.json({ error: "Could not load panels" }, { status: 500 });
  }

  const panelIds = (panels ?? []).map((p: any) => p.id as string);
  const counts: Record<string, { waiting: number; called: number; done: number; no_show: number }> = {};
  for (const id of panelIds) counts[id] = { waiting: 0, called: 0, done: 0, no_show: 0 };

  if (panelIds.length > 0) {
    const { data: tokens, error: tokensError } = await supabase
      .from("recruit_interview_tokens")
      .select("panel_id, status")
      .in("panel_id", panelIds);

    if (tokensError) {
      console.error("recruitment panels GET token counts error", tokensError);
      return NextResponse.json({ error: "Could not load panels" }, { status: 500 });
    }

    for (const t of tokens ?? []) {
      const bucket = counts[t.panel_id as string];
      if (bucket && t.status in bucket) {
        (bucket as Record<string, number>)[t.status as string] += 1;
      }
    }
  }

  const data = (panels ?? []).map((p: any) => {
    const base = {
      id: p.id,
      domain_label: p.domain_label,
      sub_domain: p.sub_domain ?? null,
      table_number: p.table_number ?? null,
      is_active: p.is_active,
      created_at: p.created_at,
      counts: counts[p.id] ?? { waiting: 0, called: 0, done: 0, no_show: 0 },
    };
    return isStaff ? { ...base, cycle_id: p.cycle_id, created_by: p.created_by } : base;
  });

  return NextResponse.json({ data });
}

// POST /api/admin/recruitment/panels
// Body: { sub_domain: string, name?: string }
//
// Domain is required — table_number (used by auto-routing and the kiosk screen's
// grouping/sorting) is always allocated server-side regardless of what's typed, so
// routing never depends on the human-editable name.
//
// `name`, when given, becomes domain_label verbatim (must be unique, case-insensitive,
// among this cycle's tables for the same domain — see the pre-insert check below). When
// omitted, domain_label falls back to the old auto-generated "<Domain> — Table N" — the
// UI always sends a prefilled default ("SPACED-Coding-" style) so this fallback is really
// just a safety net for direct API callers, not the normal path.
//
// table_number is allocated read-then-insert (SELECT max() then INSERT), same race as
// token_number in ../scan/route.ts, guarded by the same retry-on-23505 pattern against
// the (cycle_id, sub_domain, table_number) unique index from migration 004.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const sub_domain = typeof body.sub_domain === "string" ? body.sub_domain.trim() : "";
  const customName = boundedText(body.name, FIELD_LIMITS.domain_label);

  if (!isRecruitSubDomain(sub_domain)) {
    return NextResponse.json({ error: "Pick a valid recruitment domain" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
  }

  if (customName) {
    const { data: duplicate } = await supabase
      .from("recruit_interview_panels")
      .select("id")
      .eq("cycle_id", cycleId)
      .eq("sub_domain", sub_domain)
      .ilike("domain_label", customName)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        { error: `A table named "${customName}" already exists for this domain` },
        { status: 409 }
      );
    }
  }

  for (let attempt = 0; attempt < MAX_TABLE_NUMBER_ATTEMPTS; attempt++) {
    const { data: maxRow } = await supabase
      .from("recruit_interview_panels")
      .select("table_number")
      .eq("cycle_id", cycleId)
      .eq("sub_domain", sub_domain)
      .order("table_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const table_number = (maxRow?.table_number ?? 0) + 1;
    const domain_label = customName || `${subDomainFullLabel(sub_domain)} — Table ${table_number}`;

    const { data, error } = await supabase
      .from("recruit_interview_panels")
      .insert({
        cycle_id: cycleId,
        domain_label,
        sub_domain,
        table_number,
        is_active: true,
        created_by: session.user,
      })
      .select(PANEL_COLUMNS)
      .single();

    if (!error) {
      return NextResponse.json(
        {
          panel_id: data.id,
          domain_label: data.domain_label,
          sub_domain: data.sub_domain ?? null,
          table_number: data.table_number ?? null,
          created_at: data.created_at,
          data,
        },
        { status: 201 }
      );
    }

    if (error.code !== UNIQUE_VIOLATION) {
      console.error("recruitment panels POST error", error);
      return NextResponse.json({ error: "Could not create panel" }, { status: 500 });
    }
    // Another table for this domain was created concurrently and took this number —
    // loop around and recompute the max.
  }

  return NextResponse.json(
    { error: "Could not allocate a table number — please try again" },
    { status: 409 }
  );
}
