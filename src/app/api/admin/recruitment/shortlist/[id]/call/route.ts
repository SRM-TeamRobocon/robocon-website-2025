import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/recruitment/shortlist/:id/call
// Marks a recruit as "called" (phone confirmation) for this shortlist row. Set once, never
// cleared or reassigned — if called_by is already set, this is a 409, not a silent
// overwrite, so the recorded caller can never be changed by a later click.
export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("recruit_shortlist_status")
    .select("id, called_by")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("shortlist call POST lookup error", fetchError);
    return NextResponse.json({ success: false, error: "Could not load shortlist row" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ success: false, error: "Shortlist row not found" }, { status: 404 });
  }

  if (existing.called_by) {
    return NextResponse.json({ success: false, error: "Already marked as called" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("recruit_shortlist_status")
    // Conditioned on called_by still being null: closes the race between the lookup above
    // and this update, where two simultaneous clicks could otherwise both pass the check
    // and the second write would silently reassign who gets credited for the call.
    .update({ called_by: session.user, called_at: new Date().toISOString() })
    .eq("id", id)
    .is("called_by", null)
    .select("id, called_by, called_at")
    .maybeSingle();

  if (error) {
    console.error("shortlist call POST update error", error);
    return NextResponse.json({ success: false, error: "Could not mark as called" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: "Already marked as called" }, { status: 409 });
  }

  const names = await resolveDisplayNames(supabase, [data.called_by]);

  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      called_by: names.get(data.called_by) ?? data.called_by,
      called_at: data.called_at,
    },
  });
}
