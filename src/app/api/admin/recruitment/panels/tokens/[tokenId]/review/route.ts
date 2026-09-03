import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 2000;

type RouteContext = { params: Promise<{ tokenId: string }> };

// PATCH /api/admin/recruitment/panels/tokens/:tokenId/review
// Body: { review_note: string }
//
// A running note a panel can write on a recruit at any point during interview day -
// while they're waiting, being interviewed, or after - independent of the final
// Selected/Rejected/Waitlisted result (that's a separate field on recruit_interview_results,
// logged only once a decision is made). See supabase/recruit-migration-022.
//
// member/lead/admin, same as marks entry: this is a note, not a decision, so it doesn't
// need the tighter gate the shortlist override endpoints have. Last writer wins - blank
// clears it to null rather than storing an empty string, matching the recruit_marks.note
// convention elsewhere in this module.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { tokenId } = await context.params;
  if (!tokenId) {
    return NextResponse.json({ success: false, error: "tokenId is required" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body?.review_note;
  if (raw !== undefined && raw !== null && typeof raw !== "string") {
    return NextResponse.json({ success: false, error: "review_note must be a string" }, { status: 400 });
  }
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed.length > MAX_LENGTH) {
    return NextResponse.json(
      { success: false, error: `review_note must be ${MAX_LENGTH} characters or less` },
      { status: 400 }
    );
  }
  const review_note = trimmed === "" ? null : trimmed;

  const supabase = createRecruitSupabaseAdminClient();

  const { data, error } = await supabase
    .from("recruit_interview_tokens")
    .update({
      review_note,
      review_updated_by: session.user,
      review_updated_at: new Date().toISOString(),
    })
    .eq("id", tokenId)
    .select("id, review_note, review_updated_by, review_updated_at")
    .maybeSingle();

  if (error) {
    console.error("recruitment token review PATCH error", error);
    return NextResponse.json({ success: false, error: "Could not save review note" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: "Token not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}
