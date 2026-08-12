import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/admin/recruitment/panels/:id — permanently remove an interview panel.
// Unlike the `close` route (which just flips is_active), this drops the row entirely.
// recruit_interview_tokens.panel_id has NO on-delete-cascade, so its rows must go first
// or the delete fails on the FK. Interview results are keyed on recruit+sub_domain, not
// panel, so logged results survive a panel deletion.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: panel, error: findError } = await supabase
    .from("recruit_interview_panels")
    .select("id, domain_label")
    .eq("id", id)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!panel) {
    return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  }

  const { error: tokensError } = await supabase.from("recruit_interview_tokens").delete().eq("panel_id", id);
  if (tokensError) {
    return NextResponse.json({ error: tokensError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase.from("recruit_interview_panels").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, domain_label: panel.domain_label });
}
