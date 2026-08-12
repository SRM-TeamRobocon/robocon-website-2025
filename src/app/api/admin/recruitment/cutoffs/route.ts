import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { RECRUIT_SUBDOMAIN_KEYS, isRecruitSubDomain, type RecruitSubDomain } from "@/lib/recruit-domains";

export const dynamic = "force-dynamic";

type ExamDomain = RecruitSubDomain;

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/cutoffs?cycle_id=<optional, defaults to active cycle>
// Always returns one row per exam domain — cutoff_marks is null for domains that
// haven't had a cutoff set yet, so the Cutoffs page can render all 4 rows up front.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycle_id") || (await getActiveCycleId(supabase));
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("recruit_cutoffs")
    .select("sub_domain, cutoff_marks, set_by, set_at")
    .eq("cycle_id", cycleId);

  if (error) {
    console.error("recruitment cutoffs GET error", error);
    return NextResponse.json({ success: false, error: "Could not load cutoffs" }, { status: 500 });
  }

  const bySubDomain = new Map((data ?? []).map((row: any) => [row.sub_domain, row]));

  const result = RECRUIT_SUBDOMAIN_KEYS.map((domain) => {
    const existing = bySubDomain.get(domain) as
      | { sub_domain: string; cutoff_marks: number; set_by: string; set_at: string }
      | undefined;
    return (
      existing ?? {
        sub_domain: domain,
        cutoff_marks: null,
        set_by: null,
        set_at: null,
      }
    );
  });

  return NextResponse.json({ success: true, data: result, cycle_id: cycleId });
}

// POST /api/admin/recruitment/cutoffs — body is an array: [{ sub_domain, cutoff_marks }]
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ success: false, error: "Request body must be a non-empty array" }, { status: 400 });
  }

  const rows: Array<{ sub_domain: ExamDomain; cutoff_marks: number }> = [];
  for (const item of body) {
    if (!isRecruitSubDomain(item?.sub_domain)) {
      return NextResponse.json(
        { success: false, error: `sub_domain must be a valid recruitment domain (got "${item?.sub_domain}")` },
        { status: 400 }
      );
    }
    const cutoff = typeof item.cutoff_marks === "number" ? item.cutoff_marks : Number(item.cutoff_marks);
    if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 100) {
      return NextResponse.json(
        { success: false, error: `cutoff_marks for ${item.sub_domain} must be an integer between 0 and 100` },
        { status: 400 }
      );
    }
    rows.push({ sub_domain: item.sub_domain, cutoff_marks: cutoff });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  const now = new Date().toISOString();
  const payload = rows.map((row) => ({
    cycle_id: cycleId,
    sub_domain: row.sub_domain,
    cutoff_marks: row.cutoff_marks,
    set_by: session.user,
    set_at: now,
  }));

  const { data, error } = await supabase
    .from("recruit_cutoffs")
    .upsert(payload, { onConflict: "cycle_id,sub_domain" })
    .select("sub_domain, cutoff_marks, set_by, set_at");

  if (error) {
    console.error("recruitment cutoffs POST error", error);
    return NextResponse.json({ success: false, error: "Could not save cutoffs" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
