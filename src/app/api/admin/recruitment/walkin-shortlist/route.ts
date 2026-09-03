import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["shortlisted", "not_shortlisted"] as const;

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// POST /api/admin/recruitment/walkin-shortlist
// Body: { recruit_id, sub_domain, status: 'shortlisted' | 'not_shortlisted' }
//
// A deliberately narrow exception to "shortlist decisions are lead/admin only"
// (src/app/api/admin/recruitment/shortlist/[id]/route.ts): a member CAN decide
// shortlisted/not-shortlisted, but ONLY for a recruit who was scanned in as a walk-in exam
// attendee (recruit_exam_attendance.is_walkin = true for this recruit+domain). That is
// verified server-side below, not just hidden behind a UI - this route is not a general
// shortlist-override backdoor for members.
//
// Why members get this at all: a walk-in exam is typically written and marked in one
// sitting during interview day, and waiting for a lead to separately review it defeats the
// point of a same-day makeup. Everyone else's shortlist status is untouched by this route.
//
// Upserts rather than requiring an existing row (unlike PATCH /shortlist/:id, which
// assumes the compute engine already created one): a walk-in recruit may have no
// recruit_shortlist_status row at all yet if a cutoff-based compute run hasn't happened
// for this domain today. method = 'walkin_manual' (not 'manual_override') so it's
// attributable to this flow specifically; the compute engine skips both methods equally
// (see shortlist/compute/route.ts) so a later bulk run never clobbers this decision.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const recruit_id = typeof body?.recruit_id === "string" ? body.recruit_id : null;
  const sub_domain = body?.sub_domain;
  const status = body?.status;

  if (!recruit_id) {
    return NextResponse.json({ success: false, error: "recruit_id is required" }, { status: 400 });
  }
  if (!isRecruitSubDomain(sub_domain)) {
    return NextResponse.json(
      { success: false, error: "sub_domain must be a valid recruitment domain" },
      { status: 400 }
    );
  }
  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { success: false, error: "status must be 'shortlisted' or 'not_shortlisted'" },
      { status: 400 }
    );
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  // The gate: this recruit must actually have a walk-in exam attendance row for this
  // domain. A member cannot use this route for anyone else, regardless of what the
  // request body claims.
  const { data: attendance, error: attendanceError } = await supabase
    .from("recruit_exam_attendance")
    .select("id")
    .eq("recruit_id", recruit_id)
    .eq("cycle_id", cycleId)
    .eq("sub_domain", sub_domain)
    .eq("is_walkin", true)
    .maybeSingle();

  if (attendanceError) {
    console.error("walkin-shortlist attendance lookup error", attendanceError);
    return NextResponse.json({ success: false, error: "Could not verify walk-in exam attendance" }, { status: 500 });
  }

  if (!attendance) {
    return NextResponse.json(
      { success: false, error: "This recruit has no walk-in exam attendance for this domain" },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("recruit_shortlist_status")
    .upsert(
      {
        cycle_id: cycleId,
        recruit_id,
        sub_domain,
        status,
        method: "walkin_manual",
        overridden_by: session.user,
        overridden_at: now,
        computed_at: now,
      },
      { onConflict: "recruit_id,sub_domain,cycle_id" }
    )
    .select("id, recruit_id, sub_domain, status, method, overridden_by, overridden_at")
    .single();

  if (error) {
    console.error("walkin-shortlist upsert error", error);
    return NextResponse.json({ success: false, error: "Could not save shortlist decision" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
