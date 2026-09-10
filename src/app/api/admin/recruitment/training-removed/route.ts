import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { fetchAllRows } from "@/lib/supabase/query-helpers";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

// GET /api/admin/recruitment/training-removed?sub_domain=<domain>
// -> list every recruit currently removed from training for that domain, in the active
//    cycle, newest-removed first.
//
// POST /api/admin/recruitment/training-removed
// Body: { recruit_id, sub_domain } -> remove a selected recruit from training for one
//    domain they applied to. Idempotent: removing an already-removed recruit is a no-op
//    success, not an error.
//
// Unremove lives in ./[id]/route.ts (DELETE by row id) - see that file for why this isn't
// a DELETE with a JSON body here.
//
// Both require an authenticated member/lead/admin session, matching every other training
// route in this module (the scanner's own role list, not the stricter admin/lead line in
// recruitment.md's role table).

const UNIQUE_VIOLATION = "23505";

interface RemovedRow {
  id: string;
  recruit_id: string;
  sub_domain: string;
  removed_by: string;
  removed_at: string;
}

interface RecruitNameRow {
  id: string;
  name: string;
  reg_no: string;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const subDomain = request.nextUrl.searchParams.get("sub_domain");
  if (!subDomain) {
    return NextResponse.json({ success: false, error: "Select a domain" }, { status: 400 });
  }
  if (!isRecruitSubDomain(subDomain)) {
    return NextResponse.json({ success: false, error: "Unknown training domain" }, { status: 400 });
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

  const { data: removedRows, error: removedError } = await fetchAllRows<RemovedRow>((from, to) =>
    supabase
      .from("recruit_training_removed")
      .select("id, recruit_id, sub_domain, removed_by, removed_at")
      .eq("cycle_id", cycle.id)
      .eq("sub_domain", subDomain)
      .order("removed_at", { ascending: false })
      .range(from, to)
  );

  if (removedError) {
    console.error("training-removed GET list error", removedError);
    return NextResponse.json({ success: false, error: "Could not load removed recruits" }, { status: 500 });
  }

  const recruitIds = Array.from(new Set(removedRows.map((r) => r.recruit_id)));
  let recruitsById = new Map<string, RecruitNameRow>();
  if (recruitIds.length > 0) {
    const { data: recruitRows, error: recruitError } = await supabase
      .from("recruit_accounts")
      .select("id, name, reg_no")
      .in("id", recruitIds);

    if (recruitError) {
      console.error("training-removed GET recruits error", recruitError);
      return NextResponse.json({ success: false, error: "Could not load removed recruits" }, { status: 500 });
    }
    recruitsById = new Map((recruitRows ?? []).map((r) => [r.id, r as RecruitNameRow]));
  }

  const removedByNames = await resolveDisplayNames(supabase, removedRows.map((r) => r.removed_by));

  const data = removedRows.map((row) => {
    const recruit = recruitsById.get(row.recruit_id);
    return {
      id: row.id,
      recruit_id: row.recruit_id,
      name: recruit?.name ?? row.recruit_id,
      reg_no: recruit?.reg_no ?? "",
      sub_domain: row.sub_domain,
      removed_by: removedByNames.get(row.removed_by) ?? row.removed_by,
      removed_at: row.removed_at,
    };
  });

  return NextResponse.json({ success: true, data });
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
  const recruitId = typeof payload.recruit_id === "string" ? payload.recruit_id.trim() : "";
  const subDomain = typeof payload.sub_domain === "string" ? payload.sub_domain.trim() : "";

  if (!recruitId || !subDomain) {
    return NextResponse.json({ success: false, error: "recruit_id and sub_domain are required" }, { status: 400 });
  }
  if (!isRecruitSubDomain(subDomain)) {
    return NextResponse.json({ success: false, error: "Unknown training domain" }, { status: 400 });
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

  const { data: recruit, error: recruitError } = await supabase
    .from("recruit_accounts")
    .select("id, name, is_selected")
    .eq("id", recruitId)
    .eq("cycle_id", cycle.id)
    .maybeSingle();

  if (recruitError) {
    console.error("training-removed POST recruit lookup error", recruitError);
    return NextResponse.json({ success: false, error: "Could not verify recruit" }, { status: 500 });
  }
  if (!recruit) {
    return NextResponse.json({ success: false, error: "Recruit not found" }, { status: 404 });
  }
  if (!recruit.is_selected) {
    return NextResponse.json({ success: false, error: "Not a selected recruit" }, { status: 400 });
  }

  const { data: selection, error: selectionError } = await supabase
    .from("recruit_interview_results")
    .select("id")
    .eq("recruit_id", recruitId)
    .eq("cycle_id", cycle.id)
    .eq("sub_domain", subDomain)
    .eq("result", "selected")
    .maybeSingle();

  if (selectionError) {
    console.error("training-removed POST selection lookup error", selectionError);
    return NextResponse.json({ success: false, error: "Could not verify domain eligibility" }, { status: 500 });
  }
  if (!selection) {
    return NextResponse.json(
      { success: false, error: `${recruit.name} was not selected in the interview for this domain` },
      { status: 400 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("recruit_training_removed")
    .insert({
      cycle_id: cycle.id,
      recruit_id: recruitId,
      sub_domain: subDomain,
      removed_by: session.user,
    })
    .select("id, removed_at")
    .single();

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      // Already removed - idempotent success, fetch the existing row's id/timestamp.
      const { data: existing, error: lookupError } = await supabase
        .from("recruit_training_removed")
        .select("id, removed_at")
        .eq("recruit_id", recruitId)
        .eq("cycle_id", cycle.id)
        .eq("sub_domain", subDomain)
        .maybeSingle();

      if (lookupError || !existing) {
        console.error("training-removed POST lookup-after-conflict error", lookupError);
        return NextResponse.json({ success: false, error: "Could not remove recruit" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        name: recruit.name,
        data: {
          id: existing.id,
          recruit_id: recruitId,
          sub_domain: subDomain,
          removed_by: session.user,
          removed_at: existing.removed_at,
        },
      });
    }
    console.error("training-removed POST insert error", insertError);
    return NextResponse.json({ success: false, error: "Could not remove recruit" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    name: recruit.name,
    data: {
      id: inserted.id,
      recruit_id: recruitId,
      sub_domain: subDomain,
      removed_by: session.user,
      removed_at: inserted.removed_at,
    },
  });
}
