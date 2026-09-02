import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { redistributeWaitingTokens } from "@/lib/recruit-interview-redistribution";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/recruitment/panels/:id/close-for-day
//
// Distinct from PATCH .../close, which is a reversible PAUSE (Reopen brings stranded
// `waiting` tokens right back). This is the non-reversible "done for the day" action: the
// panel is deactivated AND every recruit still `waiting` on it is either moved onto another
// currently-open table for the same domain, or flipped to `deferred` if none is open - see
// redistributeWaitingTokens for the balancing/ordering rules (also shared with panel
// deletion, which needs the exact same redistribution before it can drop a table's row).
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: panelId } = await context.params;
  const supabase = createRecruitSupabaseAdminClient();

  const { data: panel, error: panelError } = await supabase
    .from("recruit_interview_panels")
    .select("id, cycle_id, sub_domain, domain_label")
    .eq("id", panelId)
    .maybeSingle();

  if (panelError) {
    console.error("close-for-day: panel lookup error", panelError);
    return NextResponse.json({ error: "Could not close this table" }, { status: 500 });
  }
  if (!panel) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const { error: deactivateError } = await supabase
    .from("recruit_interview_panels")
    .update({ is_active: false })
    .eq("id", panelId);

  if (deactivateError) {
    console.error("close-for-day: deactivate error", deactivateError);
    return NextResponse.json({ error: "Could not close this table" }, { status: 500 });
  }

  try {
    const { moved, deferred } = await redistributeWaitingTokens(supabase, panel);
    return NextResponse.json({ closed_for_day: true, moved, deferred });
  } catch (error) {
    console.error("close-for-day: redistribution error", error);
    // The panel is already deactivated at this point - that part succeeded and won't be
    // retried, only the redistribution failed. Surface it distinctly so a lead knows to
    // manually check on stranded waiting tokens rather than assuming nothing happened.
    return NextResponse.json(
      { error: "Table closed, but some recruits could not be redistributed - check the queue manually." },
      { status: 500 }
    );
  }
}
