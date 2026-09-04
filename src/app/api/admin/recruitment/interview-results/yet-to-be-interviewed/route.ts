import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { selectInChunks } from "@/lib/supabase/query-helpers";

export const dynamic = "force-dynamic";

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/interview-results/yet-to-be-interviewed?sub_domain=X
//
// New 2026-09-04: recruits shortlisted for a domain who have never checked in for its
// interview at all - no recruit_interview_tokens row for (cycle, recruit, sub_domain), so
// they're not in the waiting pool, not called, not done, not even a no-show. Distinct from
// "waiting" (checked in, hasn't been called yet) and "no_show" (was called, didn't appear) -
// this is purely "expected, hasn't shown up to check in yet". Full profile fields included
// (gender/hostel/year/etc.) so the UI can filter and show a breakdown the same way the
// Shortlist page already does, without a second round trip.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sub_domain = new URL(request.url).searchParams.get("sub_domain");
  if (!isRecruitSubDomain(sub_domain)) {
    return NextResponse.json({ error: "sub_domain must be a valid recruitment domain" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
  }

  const [{ data: shortlisted, error: shortlistError }, { data: tokens, error: tokensError }] = await Promise.all([
    supabase
      .from("recruit_shortlist_status")
      .select("recruit_id")
      .eq("cycle_id", cycleId)
      .eq("sub_domain", sub_domain)
      .eq("status", "shortlisted"),
    supabase
      .from("recruit_interview_tokens")
      .select("recruit_id")
      .eq("cycle_id", cycleId)
      .eq("sub_domain", sub_domain),
  ]);

  if (shortlistError || tokensError) {
    console.error("yet-to-be-interviewed GET error", shortlistError ?? tokensError);
    return NextResponse.json({ error: "Could not load the list" }, { status: 500 });
  }

  const checkedInIds = new Set((tokens ?? []).map((t: any) => t.recruit_id as string));
  const pendingIds = Array.from(
    new Set((shortlisted ?? []).map((s: any) => s.recruit_id as string))
  ).filter((id) => !checkedInIds.has(id));

  if (pendingIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: accounts, error: accountsError } = await selectInChunks<{
    id: string;
    name: string;
    reg_no: string;
    year: string;
    gender: string | null;
    department: string;
    phone: string | null;
    is_hosteller: boolean;
    hostel_block: string | null;
    hostel_room: string | null;
    day_scholar_area: string | null;
    travel_method: string | null;
  }>(pendingIds, (chunk) =>
    supabase
      .from("recruit_accounts")
      .select(
        "id, name, reg_no, year, gender, department, phone, is_hosteller, hostel_block, hostel_room, day_scholar_area, travel_method"
      )
      .in("id", chunk)
  );

  if (accountsError) {
    console.error("yet-to-be-interviewed GET accounts error", accountsError);
    return NextResponse.json({ error: "Could not load the list" }, { status: 500 });
  }

  return NextResponse.json({ data: accounts });
}
