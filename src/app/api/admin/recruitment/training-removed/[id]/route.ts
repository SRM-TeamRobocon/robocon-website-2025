import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/admin/recruitment/training-removed/:id - "unremove" a recruit, putting them
// back into the normal attended/pending training views for that domain. Scoped to the
// active cycle, same as training-sessions/[id]/route.ts's DELETE, so a stale tab from a
// past season can't touch this season's rows (or vice versa).
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing removal id" }, { status: 400 });
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

  const { data: removedRow, error: lookupError } = await supabase
    .from("recruit_training_removed")
    .select("recruit_id, sub_domain")
    .eq("id", id)
    .eq("cycle_id", cycle.id)
    .maybeSingle();

  if (lookupError) {
    console.error("training-removed DELETE lookup error", lookupError);
    return NextResponse.json({ success: false, error: "Could not unremove recruit" }, { status: 500 });
  }
  if (!removedRow) {
    return NextResponse.json({ success: false, error: "Removal not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("recruit_training_removed")
    .delete()
    .eq("id", id)
    .eq("cycle_id", cycle.id);

  if (deleteError) {
    console.error("training-removed DELETE error", deleteError);
    return NextResponse.json({ success: false, error: "Could not unremove recruit" }, { status: 500 });
  }

  const { data: recruit } = await supabase
    .from("recruit_accounts")
    .select("name")
    .eq("id", removedRow.recruit_id)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    recruit_id: removedRow.recruit_id,
    sub_domain: removedRow.sub_domain,
    name: recruit?.name,
  });
}
