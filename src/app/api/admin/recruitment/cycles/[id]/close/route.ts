import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/recruitment/cycles/:id/close — admin only. Sets closed_at = now(),
// is_active = false.
//
// This takes the whole recruitment module offline for students: with no active cycle every
// `.single()` active-cycle lookup (signup, dashboard, scanners, marks, interviews) returns
// 503. That is recoverable — PATCH .../cycles/:id/activate re-activates any cycle — but the
// UI must warn before calling this, and does.
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden — admin only." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing cycle id." }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: updated, error } = await supabase
    .from("recruitment_cycles")
    .update({ is_active: false, closed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("recruitment cycle close error", error);
    return NextResponse.json({ success: false, error: "Could not close cycle." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ success: false, error: "Cycle not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updated });
}
