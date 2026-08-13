import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { reattachHistoricalTokens, redistributeWaitingTokens } from "@/lib/recruit-interview-redistribution";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/admin/recruitment/panels/:id — permanently remove an interview table.
// Unlike `close`/`close-for-day` (which just flip is_active), this drops the row entirely.
//
// Before that can happen: every `waiting` recruit is redistributed exactly like
// close-for-day (moved to another open same-domain table, or `deferred` if none is open —
// see redistributeWaitingTokens), and every OTHER token still pointing at this panel
// (called/done/no_show/deferred) is reattached to some other still-existing panel — the FK
// on recruit_interview_tokens.panel_id is NOT NULL with no ON DELETE CASCADE, so a token
// left pointing at a deleted row simply isn't possible; see reattachHistoricalTokens for
// why that reattachment is always safe (none of those statuses render via panel affiliation
// anywhere). Interview results are keyed on recruit+sub_domain, not panel, so logged
// results survive a panel deletion regardless.
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
    .select("id, cycle_id, sub_domain, domain_label")
    .eq("id", id)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!panel) {
    return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  }

  let moved = 0;
  let deferred = 0;
  try {
    const result = await redistributeWaitingTokens(supabase, panel);
    moved = result.moved;
    deferred = result.deferred;
  } catch (error) {
    console.error("panel delete: redistribution error", error);
    return NextResponse.json({ error: "Could not redistribute waiting recruits — table not deleted" }, { status: 500 });
  }

  const reattached = await reattachHistoricalTokens(supabase, panel);
  if (!reattached.ok) {
    return NextResponse.json({ error: reattached.reason }, { status: 409 });
  }

  const { error: tokensError } = await supabase.from("recruit_interview_tokens").delete().eq("panel_id", id);
  if (tokensError) {
    return NextResponse.json({ error: tokensError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase.from("recruit_interview_panels").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, domain_label: panel.domain_label, moved, deferred });
}
