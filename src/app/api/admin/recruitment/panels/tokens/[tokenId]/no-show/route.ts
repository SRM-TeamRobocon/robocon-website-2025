import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tokenId: string }> };

// PATCH /api/admin/recruitment/panels/tokens/:tokenId/no-show
// Sets a token's status to no_show. Does NOT create a recruit_interview_results row -
// the recruit never interviewed. The panel dashboard can then call-next again.
//
// Guarded to tokens still in play (`waiting` / `called`) so a stale tab can't retroactively
// flip an already-interviewed (`done`) token to no_show and orphan its result row.
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
    .update({ status: "no_show" })
    .eq("id", tokenId)
    .in("status", ["waiting", "called"])
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("recruitment no-show error", error);
    return NextResponse.json({ error: "Could not mark no-show" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "This token is no longer waiting or called - refresh the queue" },
      { status: 409 }
    );
  }

  return NextResponse.json({ no_show: true });
}
