import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; tokenId: string }> };

// Fresh gap between two neighbours when one side is open-ended.
const POSITION_GAP = 1000;

// PATCH /api/admin/recruitment/panels/:id/tokens/:tokenId/reorder
// Body: { after_token_id: string | null } - "place this token immediately after
// after_token_id in the waiting queue" (null = move to the very front).
//
// Drag-and-drop reordering only ever touches the moved row: queue_position is a float,
// so the new value is just the midpoint between its new neighbours' positions - no
// renumbering of the rest of the queue, no lock contention with a concurrent Call Next.
// token_number (the recruit's permanent, dashboard-visible "#12") is never touched here.
//
// Only `waiting` tokens can be reordered - a `called`/`done`/`no_show` token isn't part
// of "who's next" any more.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: panelId, tokenId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const afterTokenId = typeof body.after_token_id === "string" ? body.after_token_id : null;

  if (afterTokenId === tokenId) {
    return NextResponse.json({ error: "A token cannot be placed after itself" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: moving, error: movingError } = await supabase
    .from("recruit_interview_tokens")
    .select("id, panel_id, status")
    .eq("id", tokenId)
    .eq("panel_id", panelId)
    .maybeSingle();

  if (movingError) {
    console.error("recruitment reorder: moving token lookup error", movingError);
    return NextResponse.json({ error: "Could not reorder queue" }, { status: 500 });
  }
  if (!moving) {
    return NextResponse.json({ error: "Token not found on this panel" }, { status: 404 });
  }
  if (moving.status !== "waiting") {
    return NextResponse.json({ error: "Only waiting tokens can be reordered" }, { status: 400 });
  }

  // The rest of the waiting queue, excluding the token being moved, in current order -
  // enough to compute both possible neighbour positions from one query.
  const { data: rest, error: restError } = await supabase
    .from("recruit_interview_tokens")
    .select("id, queue_position")
    .eq("panel_id", panelId)
    .eq("status", "waiting")
    .neq("id", tokenId)
    .order("queue_position", { ascending: true });

  if (restError) {
    console.error("recruitment reorder: queue lookup error", restError);
    return NextResponse.json({ error: "Could not reorder queue" }, { status: 500 });
  }

  const waiting = (rest ?? []) as { id: string; queue_position: number }[];

  let newPosition: number;

  if (afterTokenId === null) {
    // Move to the front of the queue.
    const first = waiting[0];
    newPosition = first ? first.queue_position - POSITION_GAP : POSITION_GAP;
  } else {
    const afterIndex = waiting.findIndex((t) => t.id === afterTokenId);
    if (afterIndex === -1) {
      return NextResponse.json({ error: "after_token_id is not waiting on this panel" }, { status: 400 });
    }
    const after = waiting[afterIndex];
    const next = waiting[afterIndex + 1];
    newPosition = next ? (after.queue_position + next.queue_position) / 2 : after.queue_position + POSITION_GAP;
  }

  const { error: updateError } = await supabase
    .from("recruit_interview_tokens")
    .update({ queue_position: newPosition })
    .eq("id", tokenId)
    .eq("status", "waiting");

  if (updateError) {
    console.error("recruitment reorder: update error", updateError);
    return NextResponse.json({ error: "Could not reorder queue" }, { status: 500 });
  }

  return NextResponse.json({ reordered: true, queue_position: newPosition });
}
