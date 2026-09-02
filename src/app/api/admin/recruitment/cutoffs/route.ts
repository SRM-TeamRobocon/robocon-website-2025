import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { RECRUIT_SUBDOMAIN_KEYS, isRecruitSubDomain, type RecruitSubDomain } from "@/lib/recruit-domains";
import { GENDERS, isGender, type Gender } from "@/lib/gender";
import { RECRUIT_YEARS, isRecruitYear, type RecruitYear } from "@/lib/recruit-year";
import { resolveDisplayNames } from "@/lib/admin-users";
import { MARKS_ERROR, parseMarksValue } from "@/lib/recruit-validation";

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

function cutoffKey(sub_domain: string, gender: string, year: string) {
  return `${sub_domain}:${gender}:${year}`;
}

// GET /api/admin/recruitment/cutoffs?cycle_id=<optional, defaults to active cycle>
// Always returns one row per (exam domain, gender, year) - 6 domains x 2 genders x 2 years -
// so the Cutoffs page can render all 24 cells up front. cutoff_marks is null for a
// domain/gender/year triple that hasn't had a cutoff set yet.
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
    .select("sub_domain, gender, year, cutoff_marks, set_by, set_at")
    .eq("cycle_id", cycleId);

  if (error) {
    console.error("recruitment cutoffs GET error", error);
    return NextResponse.json({ success: false, error: "Could not load cutoffs" }, { status: 500 });
  }

  const byKey = new Map((data ?? []).map((row: any) => [cutoffKey(row.sub_domain, row.gender, row.year), row]));
  const setByNames = await resolveDisplayNames(supabase, (data ?? []).map((row: any) => row.set_by));

  const result = RECRUIT_SUBDOMAIN_KEYS.flatMap((domain) =>
    GENDERS.flatMap((g) =>
      RECRUIT_YEARS.map((y) => {
        const existing = byKey.get(cutoffKey(domain, g.key, y.key)) as
          | { sub_domain: string; gender: string; year: string; cutoff_marks: number | string | null; set_by: string; set_at: string }
          | undefined;
        if (!existing) {
          return {
            sub_domain: domain,
            gender: g.key,
            year: y.key,
            cutoff_marks: null,
            set_by: null,
            set_at: null,
          };
        }
        return {
          ...existing,
          // cutoff_marks is `numeric` read through the untyped recruit client, so it can
          // arrive as a string ("72.50"). Ship a real number so the Cutoffs page renders
          // "72.5" rather than "72.50" and never compares strings.
          cutoff_marks: existing.cutoff_marks === null ? null : Number(existing.cutoff_marks),
          set_by: setByNames.get(existing.set_by) ?? existing.set_by,
        };
      })
    )
  );

  return NextResponse.json({ success: true, data: result, cycle_id: cycleId });
}

// POST /api/admin/recruitment/cutoffs - body is an array: [{ sub_domain, gender, year, cutoff_marks }]
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

  const rows: Array<{ sub_domain: ExamDomain; gender: Gender; year: RecruitYear; cutoff_marks: number }> = [];
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
    if (!isRecruitYear(item?.year)) {
      return NextResponse.json(
        { success: false, error: `year must be "1" or "2" (got "${item?.year}")` },
        { status: 400 }
      );
    }
    const cutoff = parseMarksValue(item.cutoff_marks);
    if (cutoff === null) {
      return NextResponse.json(
        { success: false, error: `cutoff_marks for ${item.sub_domain} (${item.gender}, year ${item.year}) is invalid. ${MARKS_ERROR}` },
        { status: 400 }
      );
    }
    rows.push({ sub_domain: item.sub_domain, gender: item.gender, year: item.year, cutoff_marks: cutoff });
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
    year: row.year,
    cutoff_marks: row.cutoff_marks,
    set_by: session.user,
    set_at: now,
  }));

  const { data, error } = await supabase
    .from("recruit_cutoffs")
    .upsert(payload, { onConflict: "cycle_id,sub_domain,gender,year" })
    .select("sub_domain, gender, year, cutoff_marks, set_by, set_at");

  if (error) {
    console.error("recruitment cutoffs POST error", error);
    return NextResponse.json({ success: false, error: "Could not save cutoffs" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
