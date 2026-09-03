import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 2000;
const MAX_INTEREST_LENGTH = 500;
const VALID_RATINGS = ["bad", "average", "good"] as const;

type RouteContext = { params: Promise<{ tokenId: string }> };

// Trims a string field to null-or-trimmed, capped at `max`. Returns `{ error }` if the
// trimmed value exceeds the cap, so callers can short-circuit with one message per field.
// Absent/undefined/null all mean "leave this field out of the update" - every field here
// is independently optional, so a panel can save just a rating without re-sending the note.
function optionalText(raw: unknown, max: number, label: string): { value?: string | null; error?: string } {
  if (raw === undefined) return {};
  if (raw !== null && typeof raw !== "string") return { error: `${label} must be a string` };
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed.length > max) return { error: `${label} must be ${max} characters or less` };
  return { value: trimmed === "" ? null : trimmed };
}

// PATCH /api/admin/recruitment/panels/tokens/:tokenId/review
// Body: { review_note?, rating?, interested_other_clubs?, interested_other_domains? } -
// every field independently optional, so the UI can save whichever ones changed. All four
// are a panel's live-during-interview notes, independent of the final
// Selected/Rejected/Waitlisted result. See supabase/recruit-migration-022 (review_note) and
// -023 (rating, interested_other_clubs, interested_other_domains).
//
// member/lead/admin, same as marks entry: these are notes, not decisions, so they don't
// need the tighter gate the shortlist override endpoints have. Blank clears a text field to
// null rather than storing an empty string, matching the recruit_marks.note convention
// elsewhere in this module. One shared `review_updated_by`/`review_updated_at` pair covers
// all four fields - they're edited together on one card, not attributed separately.
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

  const reviewNote = optionalText(body?.review_note, MAX_LENGTH, "review_note");
  if (reviewNote.error) {
    return NextResponse.json({ success: false, error: reviewNote.error }, { status: 400 });
  }

  const clubs = optionalText(body?.interested_other_clubs, MAX_INTEREST_LENGTH, "interested_other_clubs");
  if (clubs.error) {
    return NextResponse.json({ success: false, error: clubs.error }, { status: 400 });
  }

  const domainsInterest = optionalText(
    body?.interested_other_domains,
    MAX_INTEREST_LENGTH,
    "interested_other_domains"
  );
  if (domainsInterest.error) {
    return NextResponse.json({ success: false, error: domainsInterest.error }, { status: 400 });
  }

  let rating: string | null | undefined;
  if (body?.rating !== undefined) {
    if (body.rating !== null && !VALID_RATINGS.includes(body.rating)) {
      return NextResponse.json(
        { success: false, error: "rating must be 'bad', 'average', 'good', or null" },
        { status: 400 }
      );
    }
    rating = body.rating;
  }

  const update: Record<string, unknown> = {
    review_updated_by: session.user,
    review_updated_at: new Date().toISOString(),
  };
  if (reviewNote.value !== undefined) update.review_note = reviewNote.value;
  if (clubs.value !== undefined) update.interested_other_clubs = clubs.value;
  if (domainsInterest.value !== undefined) update.interested_other_domains = domainsInterest.value;
  if (rating !== undefined) update.rating = rating;

  const supabase = createRecruitSupabaseAdminClient();

  const { data, error } = await supabase
    .from("recruit_interview_tokens")
    .update(update)
    .eq("id", tokenId)
    .select(
      "id, review_note, rating, interested_other_clubs, interested_other_domains, review_updated_by, review_updated_at"
    )
    .maybeSingle();

  if (error) {
    console.error("recruitment token review PATCH error", error);
    return NextResponse.json({ success: false, error: "Could not save review" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: "Token not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}
