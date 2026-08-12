import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
export const dynamic = "force-dynamic";

const VALID_STATUSES = ["shortlisted", "not_shortlisted"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

// PATCH /api/admin/recruitment/shortlist/:id
// Manually overrides a recruit_shortlist_status row's status (method becomes
// 'manual_override'). The id always refers to an existing row: rows are created by the
// compute engine (POST /shortlist/compute) before the page ever renders an override button.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body?.status;
  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { success: false, error: "status must be 'shortlisted' or 'not_shortlisted'" },
      { status: 400 }
    );
  }

  const override_reason = typeof body?.override_reason === "string" ? body.override_reason : null;

  const supabase = createRecruitSupabaseAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("recruit_shortlist_status")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("shortlist PATCH lookup error", fetchError);
    return NextResponse.json({ success: false, error: "Could not load shortlist row" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ success: false, error: "Shortlist row not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("recruit_shortlist_status")
    .update({
      status,
      method: "manual_override",
      override_reason,
      overridden_by: session.user,
      overridden_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(
      "id, recruit_id, sub_domain, status, method, override_reason, overridden_by, overridden_at, computed_at"
    )
    .single();

  if (error) {
    console.error("shortlist PATCH update error", error);
    return NextResponse.json({ success: false, error: "Could not update shortlist status" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
