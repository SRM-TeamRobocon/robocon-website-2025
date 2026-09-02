import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

// PATCH /api/admin/recruitment/cycles/:id/activate - admin only.
//
// The recovery path for the previously one-way cycle lifecycle: before this route, closing a
// cycle (or a half-failed create) left ZERO active cycles and every `.single()` active-cycle
// lookup in the module returned 503/500 with no fix short of manual SQL.
//
// Stands every other cycle down, then activates this one, and clears closed_at so a
// re-opened cycle no longer reads as "Closed". Two statements rather than one transaction -
// the partial unique index `recruitment_cycles_single_active` is what actually guarantees
// a concurrent activate can never leave two cycles active (it raises 23505 instead).
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden - admin only." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing cycle id." }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: target, error: lookupError } = await supabase
    .from("recruitment_cycles")
    .select("id, is_active")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("recruitment cycle activate lookup error", lookupError);
    return NextResponse.json({ success: false, error: "Could not activate cycle." }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ success: false, error: "Cycle not found." }, { status: 404 });
  }

  // Stand down every other cycle first - activating first would trip the single-active index.
  const { error: deactivateError } = await supabase
    .from("recruitment_cycles")
    .update({ is_active: false })
    .eq("is_active", true)
    .neq("id", id);

  if (deactivateError) {
    console.error("recruitment cycle activate deactivate-others error", deactivateError);
    return NextResponse.json(
      { success: false, error: "Could not stand down the current cycle. Nothing was changed." },
      { status: 500 }
    );
  }

  const { data: updated, error: activateError } = await supabase
    .from("recruitment_cycles")
    .update({ is_active: true, closed_at: null })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (activateError) {
    console.error("recruitment cycle activate error", activateError);
    if (isUniqueViolation(activateError)) {
      return NextResponse.json(
        {
          success: false,
          error: "Another cycle was activated at the same time. Reload the page and try again.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: "Could not activate cycle." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ success: false, error: "Cycle not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updated });
}
