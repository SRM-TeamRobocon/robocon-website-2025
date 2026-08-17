import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { boundedText, FIELD_LIMITS } from "@/lib/recruit-validation";
import { isHostelBlock } from "@/lib/hostel-blocks";
import { isTravelMethod } from "@/lib/travel-method";
import { isGender } from "@/lib/gender";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/recruitment/recruits/:id — edit a recruit's own profile fields.
// Deliberately does NOT allow editing srm_email/password (auth-sensitive — email is the
// login identity and unique per cycle) or `domains` (recruit_domain_selections rows are
// the join key for marks/shortlist/interview_tokens; changing them here without touching
// those tables would silently orphan data — that's a bigger operation than a name/phone
// fix and belongs in a dedicated flow if it's ever needed).
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
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

  const name = boundedText(body.name, FIELD_LIMITS.name);
  const reg_no = boundedText(body.reg_no, FIELD_LIMITS.reg_no);
  const year = typeof body.year === "string" ? body.year : "";
  // Not hard-required here (same leniency as day_scholar_area/travel_method below) — this
  // route also has to accept legacy recruits that predate this column.
  const gender = isGender(body.gender) ? body.gender : null;
  const department = boundedText(body.department, FIELD_LIMITS.department);
  const course = boundedText(body.course, FIELD_LIMITS.course);
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const isHosteller = body.is_hosteller === true;

  if (!name || !reg_no || !department || !course) {
    return NextResponse.json({ success: false, error: "Name, reg no, department and course are required." }, { status: 400 });
  }
  if (!["1", "2", "3"].includes(year)) {
    return NextResponse.json({ success: false, error: "Invalid year of study." }, { status: 400 });
  }
  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json({ success: false, error: "Phone must be a 10-digit number." }, { status: 400 });
  }

  // Mirrors complete-registration's rule: a non-hosteller is forced to (false, null, null)
  // rather than trusting the client to clear block/room when the toggle flips off — the DB
  // check constraint from migration 004 rejects a block/room on a non-hosteller outright.
  const hostel_block = isHosteller ? boundedText(body.hostel_block, FIELD_LIMITS.hostel_block) : null;
  const hostel_room = isHosteller ? boundedText(body.hostel_room, FIELD_LIMITS.hostel_room) : null;
  if (isHosteller && !isHostelBlock(hostel_block)) {
    return NextResponse.json({ success: false, error: "Select a valid hostel block." }, { status: 400 });
  }
  // Day-scholar-only counterparts, same shape as hostel_block/hostel_room above. Not
  // required here (same leniency as hostel_room isn't required on this admin-edit path) —
  // this route also has to accept legacy day-scholar rows that predate these fields.
  const day_scholar_area = !isHosteller ? boundedText(body.day_scholar_area, FIELD_LIMITS.day_scholar_area) : null;
  const travel_method = !isHosteller && isTravelMethod(body.travel_method) ? body.travel_method : null;

  const supabase = createRecruitSupabaseAdminClient();

  const { data, error } = await supabase
    .from("recruit_accounts")
    .update({
      name,
      reg_no,
      year,
      gender,
      department,
      course,
      phone,
      is_hosteller: isHosteller,
      hostel_block,
      hostel_room,
      day_scholar_area,
      travel_method,
    })
    .eq("id", id)
    .select(
      "id, name, reg_no, year, gender, department, course, phone, is_hosteller, hostel_block, hostel_room, day_scholar_area, travel_method"
    )
    .maybeSingle();

  if (error) {
    console.error("recruit PATCH error", error);
    return NextResponse.json({ success: false, error: "Could not save recruit." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "Recruit not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

// DELETE /api/admin/recruitment/recruits/:id — permanently remove a recruit.
// Every recruit_* child table references recruit_accounts(id) with `on delete cascade`
// (see supabase/recruit-schema.sql), so this single delete also drops their domain
// selections, attendance scans, marks, shortlist status, interview tokens/results and
// training attendance. There is no undo — the UI confirms before calling this.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();

  const { data: recruit, error: findError } = await supabase
    .from("recruit_accounts")
    .select("id, name, reg_no")
    .eq("id", id)
    .maybeSingle();

  if (findError) {
    console.error("recruit delete lookup error", findError);
    return NextResponse.json({ success: false, error: "Could not load recruit." }, { status: 500 });
  }
  if (!recruit) {
    return NextResponse.json({ success: false, error: "Recruit not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("recruit_accounts").delete().eq("id", id);
  if (deleteError) {
    console.error("recruit delete error", deleteError);
    return NextResponse.json({ success: false, error: "Could not delete recruit." }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: { id: recruit.id, name: recruit.name } });
}
