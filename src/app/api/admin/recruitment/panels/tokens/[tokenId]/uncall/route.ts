import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tokenId: string }> };

// PATCH /api/admin/recruitment/panels/tokens/:tokenId/uncall
//
// New 2026-09-04, for "called the wrong recruit by mistake". Reverses a `called` token back
// to `waiting` AND returns it to the shared domain pool (panel_id/queue_position cleared,
// same shape as a fresh check-in under migration 024) rather than leaving it attached to
// this panel - the whole point of the shared pool is that nobody belongs to a specific table
// until a call actually sticks, and a mistaken call shouldn't be the exception. checked_in_at
// is left untouched, so the recruit keeps their original place in line (Call Next elsewhere
// orders by checked_in_at) instead of being pushed to the back for someone else's mistake.
//
// Guarded to `called` only - uncalling a `waiting`/`done`/`no_show` token makes no sense, and
// a `done` token would orphan its logged result if reopened this way.
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tokenId } = await context.params;
  if (!tokenId) {
    return NextResponse.json({ error: "tokenId is required" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const { data, error } = await supabase
    .from("recruit_interview_tokens")
    .update({ status: "waiting", panel_id: null, queue_position: null, called_at: null })
    .eq("id", tokenId)
    .eq("status", "called")
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("recruitment uncall error", error);
    return NextResponse.json({ error: "Could not uncall this recruit" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "This token isn't currently called - refresh the queue" },
      { status: 409 }
    );
  }

  return NextResponse.json({ uncalled: true });
}
