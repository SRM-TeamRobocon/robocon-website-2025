import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";

// POST /api/admin/recruitment/interview-auto-noshow
//
// Self-healing for the walk-in interview queue: if a volunteer calls a recruit
// (status -> 'called') and then forgets to resolve them to 'done'/'no_show', that
// panel's Call Next button refuses to advance forever (only one `called` token per
// panel is allowed at a time). Hit on a 5-minute schedule by Vercel Cron (see
// vercel.json) — auth is a CRON_SECRET bearer token, mirroring
// src/app/api/attendance/auto-checkout/route.ts, not the admin_token/getSession()
// cookie flow used by the rest of this route tree. Vercel Cron only sends GET and
// injects that bearer header automatically when the env var is named CRON_SECRET.
export const dynamic = "force-dynamic";

const NO_SHOW_TIMEOUT_MINUTES = 15;

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || "local-dev"}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createRecruitSupabaseAdminClient();

    const cycleId = await getActiveCycleId(supabase);
    if (!cycleId) {
      return NextResponse.json({ success: true, flagged: 0, message: "No active recruitment cycle" });
    }

    const cutoffIso = new Date(Date.now() - NO_SHOW_TIMEOUT_MINUTES * 60_000).toISOString();

    const { data, error } = await supabase
      .from("recruit_interview_tokens")
      .update({ status: "no_show" })
      .eq("cycle_id", cycleId)
      .eq("status", "called")
      .lt("called_at", cutoffIso)
      .select("id, recruit_id, panel_id, token_number");

    if (error) {
      console.error("recruitment interview-auto-noshow error", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const tokens = data ?? [];

    return NextResponse.json({ success: true, flagged: tokens.length, tokens });
  } catch (error) {
    console.error("recruitment interview-auto-noshow error", error);
    return NextResponse.json({ success: false, error: "Could not auto-flag no-shows" }, { status: 500 });
  }
}

export const GET = POST;
