import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

async function getActiveCycleId(supabase: SupabaseClient): Promise<string | null> {
    const { data } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/tickets
// Every ticket for the active cycle, open first then newest-first, joined with the
// recruit's identity. Read access is broad (member/lead/admin, matching every other
// recruitment sub-page) — the resolve action itself is lead/admin-only, enforced in
// [id]/resolve/route.ts regardless of who can view this list.
export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createRecruitSupabaseAdminClient();
    const cycleId = await getActiveCycleId(supabase);
    if (!cycleId) {
        return NextResponse.json({ error: "No active recruitment cycle" }, { status: 503 });
    }

    const { data: tickets, error } = await supabase
        .from("recruit_tickets")
        .select(
            "id, category, message, current_sub_domains, from_sub_domain, requested_sub_domain, status, resolution_note, resolved_by, resolved_at, created_at, recruit_id"
        )
        .eq("cycle_id", cycleId)
        .order("status", { ascending: true }) // 'open' < 'resolved' alphabetically — open first
        .order("created_at", { ascending: false });

    if (error) {
        console.error("admin tickets GET error", error);
        return NextResponse.json({ error: "Could not load tickets" }, { status: 500 });
    }

    const recruitIds = Array.from(new Set((tickets ?? []).map((t) => t.recruit_id as string)));
    const recruits = new Map<string, { name: string; reg_no: string; srm_email: string }>();

    if (recruitIds.length > 0) {
        const { data: accounts, error: accountsError } = await supabase
            .from("recruit_accounts")
            .select("id, name, reg_no, srm_email")
            .in("id", recruitIds);

        if (accountsError) {
            console.error("admin tickets GET: recruit lookup error", accountsError);
            return NextResponse.json({ error: "Could not load tickets" }, { status: 500 });
        }

        for (const a of accounts ?? []) {
            recruits.set(a.id as string, { name: a.name, reg_no: a.reg_no, srm_email: a.srm_email });
        }
    }

    const data = (tickets ?? []).map((t) => ({
        ...t,
        recruit: recruits.get(t.recruit_id as string) ?? { name: "Unknown", reg_no: "", srm_email: "" },
    }));

    return NextResponse.json({ data });
}
