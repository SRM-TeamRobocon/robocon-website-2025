import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/recruitment/panels/:id/close
// Sets is_active = false. Any remaining `waiting` tokens are left as-is (per
// 07-INTERVIEW-MODULE.md) — no cascade update to token rows. Closing is reversible via the
// sibling /reopen route, so stranded waiting tokens are recoverable; we return
// `waiting_left` so the UI can surface the count in its confirm dialog and afterwards.
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { count: waitingLeft, error: countError } = await supabase
    .from("recruit_interview_tokens")
    .select("id", { count: "exact", head: true })
    .eq("panel_id", id)
    .eq("status", "waiting");

  if (countError) {
    console.error("recruitment panel close: waiting count error", countError);
  }

  const { data, error } = await supabase
    .from("recruit_interview_panels")
    .update({ is_active: false })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("recruitment panel close error", error);
    return NextResponse.json({ error: "Could not close panel" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  }

  return NextResponse.json({ closed: true, waiting_left: waitingLeft ?? 0 });
}
