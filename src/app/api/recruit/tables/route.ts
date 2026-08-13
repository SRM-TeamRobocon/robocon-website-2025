import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { displayFirstName } from "../../admin/recruitment/panels/[id]/queue/route";

export const dynamic = "force-dynamic";

// GET /api/recruit/tables
//
// Fully public, no session of any kind — see the carve-out in src/proxy.ts. Backs the
// /recruit/tables kiosk screen: a lobby-TV/own-phone view of every open interview table
// so recruits can see which line to join without asking a volunteer. Payload is the same
// "safe" shape role "member" gets from the per-panel queue route (token number + first
// name only) — never reg_no, department, marks, or shortlist state.
export async function GET() {
    const supabase = createRecruitSupabaseAdminClient();

    const { data: activeCycle } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
    if (!activeCycle) {
        return NextResponse.json({ tables: [] });
    }

    const { data: panels, error: panelsError } = await supabase
        .from("recruit_interview_panels")
        .select("id, domain_label, sub_domain, table_number")
        .eq("cycle_id", activeCycle.id)
        .eq("is_active", true)
        .order("sub_domain", { ascending: true })
        .order("table_number", { ascending: true });

    if (panelsError) {
        console.error("public recruit tables GET error", panelsError);
        return NextResponse.json({ error: "Could not load tables" }, { status: 500 });
    }

    const panelIds = (panels ?? []).map((p) => p.id);
    if (panelIds.length === 0) {
        return NextResponse.json({ tables: [] });
    }

    const { data: tokens, error: tokensError } = await supabase
        .from("recruit_interview_tokens")
        .select("id, token_number, queue_position, status, recruit_id, panel_id")
        .in("panel_id", panelIds)
        .in("status", ["waiting", "called"])
        .order("queue_position", { ascending: true });

    if (tokensError) {
        console.error("public recruit tables GET tokens error", tokensError);
        return NextResponse.json({ error: "Could not load tables" }, { status: 500 });
    }

    const recruitIds = Array.from(new Set((tokens ?? []).map((t) => t.recruit_id as string)));
    const names = new Map<string, string>();
    if (recruitIds.length > 0) {
        const { data: recruits } = await supabase.from("recruit_accounts").select("id, name").in("id", recruitIds);
        for (const r of recruits ?? []) names.set(r.id as string, displayFirstName(r.name as string));
    }

    const byPanel = new Map<string, { token_number: number; status: string; first_name: string }[]>();
    for (const t of tokens ?? []) {
        const entry = { token_number: t.token_number, status: t.status, first_name: names.get(t.recruit_id) ?? "" };
        (byPanel.get(t.panel_id) ?? byPanel.set(t.panel_id, []).get(t.panel_id)!).push(entry);
    }

    // Full waiting line, not capped — the kiosk page renders it in a scrollable box so an
    // arbitrarily long line doesn't need a server-side limit.
    const tables = (panels ?? []).map((p) => {
        const panelTokens = byPanel.get(p.id) ?? [];
        const nowServing = panelTokens.find((t) => t.status === "called") ?? null;
        const waiting = panelTokens.filter((t) => t.status === "waiting");
        return {
            id: p.id,
            domain_label: p.domain_label,
            sub_domain: p.sub_domain,
            table_number: p.table_number,
            now_serving: nowServing ? { token_number: nowServing.token_number, first_name: nowServing.first_name } : null,
            waiting: waiting.map((t) => ({ token_number: t.token_number, first_name: t.first_name })),
        };
    });

    return NextResponse.json({ tables });
}
