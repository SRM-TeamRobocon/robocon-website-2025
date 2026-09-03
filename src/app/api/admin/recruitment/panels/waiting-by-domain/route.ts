import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { buildRecruitProfiles } from "../[id]/queue/route";

export const dynamic = "force-dynamic";

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/panels/waiting-by-domain?sub_domain=X
//
// Emergency add, 2026-09-03, alongside the queue-route crash fix in ../[id]/queue: with
// several tables open for one domain (live on SAMBED right now), a single panel's own
// /queue only shows tokens auto-routed onto THAT specific panel - there was no way for a
// table to see, or call, someone waiting on a different table for the same domain. This
// aggregates every `waiting` token across every currently OPEN panel for one sub_domain,
// oldest check-in first, so any table can see the whole domain's line and pull a specific
// recruit over via the existing (previously unused) POST .../panels/:id/call-token.
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

  // sub_domain is denormalized onto tokens (migration 004), so this is one filter rather
  // than a join through panels.
  const { data: tokens, error: tokensError } = await supabase
    .from("recruit_interview_tokens")
    .select("id, token_number, checked_in_at, is_walkin, recruit_id, panel_id")
    .eq("cycle_id", cycleId)
    .eq("sub_domain", sub_domain)
    .eq("status", "waiting")
    .order("checked_in_at", { ascending: true });

  if (tokensError) {
    console.error("waiting-by-domain GET tokens error", tokensError);
    return NextResponse.json({ error: "Could not load waiting list" }, { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const panelIds = Array.from(new Set(tokens.map((t: any) => t.panel_id as string)));
  const { data: panels, error: panelsError } = await supabase
    .from("recruit_interview_panels")
    .select("id, domain_label, is_active")
    .in("id", panelIds);

  if (panelsError) {
    console.error("waiting-by-domain GET panels error", panelsError);
    return NextResponse.json({ error: "Could not load waiting list" }, { status: 500 });
  }

  // Only offer up tokens whose table is still open - Close for the Day / Delete already
  // redistribute `waiting` tokens away from a closing panel, so a waiting token on a
  // closed panel shouldn't normally exist, but this is a cheap guard against surfacing a
  // dead-end "call" button if it ever does.
  const panelById = new Map((panels ?? []).filter((p: any) => p.is_active).map((p: any) => [p.id, p]));
  const liveTokens = tokens.filter((t: any) => panelById.has(t.panel_id));

  const recruitIds = Array.from(new Set(liveTokens.map((t: any) => t.recruit_id as string)));
  const profiles = await buildRecruitProfiles(supabase, recruitIds);

  const data = liveTokens.map((t: any) => {
    const panel = panelById.get(t.panel_id);
    return {
      token_id: t.id,
      token_number: t.token_number,
      checked_in_at: t.checked_in_at,
      is_walkin: Boolean(t.is_walkin),
      panel_id: t.panel_id,
      panel_label: panel?.domain_label ?? "",
      recruit: profiles.get(t.recruit_id) ?? null,
    };
  });

  return NextResponse.json({ data });
}
