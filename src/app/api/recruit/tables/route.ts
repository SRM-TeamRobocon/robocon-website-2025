import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { RECRUIT_SUBDOMAINS, subDomainLabel, subDomainSubsystem } from "@/lib/recruit-domains";
import { displayFirstName } from "../../admin/recruitment/panels/[id]/queue/route";

export const dynamic = "force-dynamic";

// GET /api/recruit/tables
//
// Fully public, no session of any kind - see the carve-out in src/proxy.ts. Backs the
// /recruit/tables kiosk screen: a lobby-TV/own-phone view of every open interview table
// plus each domain's waiting line, so recruits can see which line to join without asking
// a volunteer. Payload is the same "safe" shape role "member" gets from the per-panel
// queue route (token number + first name only) - never reg_no, department, marks, or
// shortlist state.
//
// Rewritten 2026-09-05: migration 024 (see recruitment.md, "check-in no longer auto-routes
// to a table") made `waiting` tokens panel_id-less - they sit in one shared pool per
// sub_domain until an interviewer actually calls them, only gaining a panel_id at that
// moment. The old query here (`waiting`/`called` tokens `.in("panel_id", panelIds)`) could
// therefore never match a `waiting` token - the kiosk's waiting chips were silently always
// empty. Waiting is now fetched once per cycle (not scoped to any panel) and grouped by
// sub_domain, matching how `.../panels/waiting-by-domain` already does it for the admin
// side. A domain with people waiting but zero open tables still gets a group, so a line
// forming ahead of a table opening is visible.
export async function GET() {
    const supabase = createRecruitSupabaseAdminClient();

    const { data: activeCycle } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
    if (!activeCycle) {
        return NextResponse.json({ domains: [] });
    }

    const { data: panels, error: panelsError } = await supabase
        .from("recruit_interview_panels")
        .select("id, domain_label, sub_domain, table_number")
        .eq("cycle_id", activeCycle.id)
        .eq("is_active", true)
        .order("table_number", { ascending: true });

    if (panelsError) {
        console.error("public recruit tables GET panels error", panelsError);
        return NextResponse.json({ error: "Could not load tables" }, { status: 500 });
    }

    // Legacy pre-migration-003 panels with no sub_domain have no domain group to sit under -
    // dropped from this view, same as before.
    const openPanels = (panels ?? []).filter((p) => p.sub_domain);
    const panelIds = openPanels.map((p) => p.id);

    const { data: calledTokens, error: calledError } = panelIds.length
        ? await supabase
              .from("recruit_interview_tokens")
              .select("token_number, called_at, recruit_id, panel_id")
              .in("panel_id", panelIds)
              .eq("status", "called")
        : { data: [], error: null };

    if (calledError) {
        console.error("public recruit tables GET called tokens error", calledError);
        return NextResponse.json({ error: "Could not load tables" }, { status: 500 });
    }

    // Shared per-domain pool, not scoped to any panel - see the note above. Fetched for the
    // whole cycle at once (not per-domain) so an idle domain with a forming line still shows.
    const { data: waitingTokens, error: waitingError } = await supabase
        .from("recruit_interview_tokens")
        .select("token_number, sub_domain, recruit_id")
        .eq("cycle_id", activeCycle.id)
        .eq("status", "waiting")
        .is("panel_id", null)
        .order("checked_in_at", { ascending: true });

    if (waitingError) {
        console.error("public recruit tables GET waiting tokens error", waitingError);
        return NextResponse.json({ error: "Could not load tables" }, { status: 500 });
    }

    const recruitIds = Array.from(
        new Set([...(calledTokens ?? []).map((t) => t.recruit_id as string), ...(waitingTokens ?? []).map((t) => t.recruit_id as string)])
    );
    const names = new Map<string, string>();
    if (recruitIds.length > 0) {
        const { data: recruits } = await supabase.from("recruit_accounts").select("id, name").in("id", recruitIds);
        for (const r of recruits ?? []) names.set(r.id as string, displayFirstName(r.name as string));
    }

    const calledByPanel = new Map<string, { token_number: number; first_name: string; called_at: string }>();
    for (const t of calledTokens ?? []) {
        calledByPanel.set(t.panel_id as string, {
            token_number: t.token_number,
            first_name: names.get(t.recruit_id as string) ?? "",
            called_at: t.called_at as string,
        });
    }

    const waitingByDomain = new Map<string, { token_number: number; first_name: string }[]>();
    for (const t of waitingTokens ?? []) {
        const key = t.sub_domain as string;
        const entry = { token_number: t.token_number, first_name: names.get(t.recruit_id as string) ?? "" };
        (waitingByDomain.get(key) ?? waitingByDomain.set(key, []).get(key)!).push(entry);
    }

    const panelsByDomain = new Map<string, typeof openPanels>();
    for (const p of openPanels) {
        const key = p.sub_domain as string;
        (panelsByDomain.get(key) ?? panelsByDomain.set(key, []).get(key)!).push(p);
    }

    // Fixed 6-domain list (not derived from panels/tokens) so a domain with a forming line
    // but no open table yet still gets a group - only domains with neither are dropped.
    const domains = RECRUIT_SUBDOMAINS.map((d) => {
        const tables = (panelsByDomain.get(d.key) ?? [])
            .slice()
            .sort((a, b) => (a.table_number ?? 0) - (b.table_number ?? 0))
            .map((p) => ({
                id: p.id,
                domain_label: p.domain_label,
                table_number: p.table_number,
                now_serving: calledByPanel.get(p.id) ?? null,
            }));
        const waiting = waitingByDomain.get(d.key) ?? [];
        return {
            sub_domain: d.key,
            domain_label: subDomainLabel(d.key),
            subsystem: subDomainSubsystem(d.key),
            tables,
            waiting,
        };
    }).filter((d) => d.tables.length > 0 || d.waiting.length > 0);

    return NextResponse.json({ domains });
}
