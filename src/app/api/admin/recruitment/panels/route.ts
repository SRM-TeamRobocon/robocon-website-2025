import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";

export const dynamic = "force-dynamic";

// Explicit column list — never `select("*")`. New columns added to
// recruit_interview_panels should be opted into here deliberately rather than
// leaking to every caller (including role "member") the moment they're created.
const PANEL_COLUMNS = "id, cycle_id, domain_label, sub_domain, is_active, created_at, created_by";

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
      is_active: p.is_active,
      created_at: p.created_at,
      counts: counts[p.id] ?? { waiting: 0, called: 0, done: 0, no_show: 0 },
    };
    return isStaff ? { ...base, cycle_id: p.cycle_id, created_by: p.created_by } : base;
  });

  return NextResponse.json({ data });
}

// POST /api/admin/recruitment/panels
// Body: { domain_label: string, sub_domain?: string | null }
//
// `domain_label` stays free text (1-50 chars) for display — panels are typed on the day
// ("Coding Panel 2", "Overflow Room"). `sub_domain`, when supplied, must be one of the six
// recruit_subdomain enum values (validated via the shared @/lib/recruit-domains config) and
// is what the panel dashboard uses to pre-select the domain a result gets logged against.
// Leaving it null is legal — the dashboard then forces the interviewer to pick explicitly
// rather than silently defaulting to an arbitrary domain.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const domain_label = typeof body.domain_label === "string" ? body.domain_label.trim() : "";
  const rawSubDomain = typeof body.sub_domain === "string" ? body.sub_domain.trim() : "";

  if (!domain_label || domain_label.length > 50) {
    return NextResponse.json({ error: "domain_label must be 1-50 characters" }, { status: 400 });
  }

  if (rawSubDomain && !isRecruitSubDomain(rawSubDomain)) {
    return NextResponse.json({ error: "sub_domain is not a recognised recruitment domain" }, { status: 400 });
  }
  const sub_domain = rawSubDomain || null;

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("recruit_interview_panels")
    .insert({
      cycle_id: cycleId,
      domain_label,
      sub_domain,
      is_active: true,
      created_by: session.user,
    })
    .select(PANEL_COLUMNS)
    .single();

  if (error) {
    console.error("recruitment panels POST error", error);
    return NextResponse.json({ error: "Could not create panel" }, { status: 500 });
  }

  return NextResponse.json(
    {
      panel_id: data.id,
      domain_label: data.domain_label,
      sub_domain: data.sub_domain ?? null,
      created_at: data.created_at,
      data,
    },
    { status: 201 }
  );
}
