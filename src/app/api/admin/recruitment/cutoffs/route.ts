import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { RECRUIT_SUBDOMAIN_KEYS, isRecruitSubDomain, type RecruitSubDomain } from "@/lib/recruit-domains";
import { GENDERS, isGender, type Gender } from "@/lib/gender";
import { resolveDisplayNames } from "@/lib/admin-users";

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

function cutoffKey(sub_domain: string, gender: string) {
  return `${sub_domain}:${gender}`;
}

// GET /api/admin/recruitment/cutoffs?cycle_id=<optional, defaults to active cycle>
// Always returns one row per (exam domain, gender) — 6 domains x 2 genders — so the Cutoffs
// page can render all 12 rows up front. cutoff_marks is null for a domain/gender pair that
// hasn't had a cutoff set yet.
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
    .select("sub_domain, gender, cutoff_marks, set_by, set_at")
    .eq("cycle_id", cycleId);

  if (error) {
    console.error("recruitment cutoffs GET error", error);
    return NextResponse.json({ success: false, error: "Could not load cutoffs" }, { status: 500 });
  }

  const byKey = new Map((data ?? []).map((row: any) => [cutoffKey(row.sub_domain, row.gender), row]));
  const setByNames = await resolveDisplayNames(supabase, (data ?? []).map((row: any) => row.set_by));

  const result = RECRUIT_SUBDOMAIN_KEYS.flatMap((domain) =>
    GENDERS.map((g) => {
      const existing = byKey.get(cutoffKey(domain, g.key)) as
        | { sub_domain: string; gender: string; cutoff_marks: number; set_by: string; set_at: string }
        | undefined;
      if (!existing) {
        return {
          sub_domain: domain,
          gender: g.key,
          cutoff_marks: null,
          set_by: null,
          set_at: null,
        };
      }
      return { ...existing, set_by: setByNames.get(existing.set_by) ?? existing.set_by };
    })
  );

  return NextResponse.json({ success: true, data: result, cycle_id: cycleId });
}

// POST /api/admin/recruitment/cutoffs — body is an array: [{ sub_domain, gender, cutoff_marks }]
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

  const rows: Array<{ sub_domain: ExamDomain; gender: Gender; cutoff_marks: number }> = [];
  for (const item of body) {
    if (!isRecruitSubDomain(item?.sub_domain)) {
      return NextResponse.json(
        { success: false, error: `sub_domain must be a valid recruitment domain (got "${item?.sub_domain}")` },
        { status: 400 }
      );
    }
    if (!isGender(item?.gender)) {
      return NextResponse.json(
        { success: false, error: `gender must be "male" or "female" (got "${item?.gender}")` },
        { status: 400 }
      );
    }
    const cutoff = typeof item.cutoff_marks === "number" ? item.cutoff_marks : Number(item.cutoff_marks);
    if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 100) {
      return NextResponse.json(
        { success: false, error: `cutoff_marks for ${item.sub_domain} (${item.gender}) must be an integer between 0 and 100` },
        { status: 400 }
      );
    }
    rows.push({ sub_domain: item.sub_domain, gender: item.gender, cutoff_marks: cutoff });
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
    gender: row.gender,
    cutoff_marks: row.cutoff_marks,
    set_by: session.user,
    set_at: now,
  }));

  const { data, error } = await supabase
    .from("recruit_cutoffs")
    .upsert(payload, { onConflict: "cycle_id,sub_domain,gender" })
    .select("sub_domain, gender, cutoff_marks, set_by, set_at");

  if (error) {
    console.error("recruitment cutoffs POST error", error);
    return NextResponse.json({ success: false, error: "Could not save cutoffs" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
