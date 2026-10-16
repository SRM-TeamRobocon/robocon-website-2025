import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { reconcileMidnightAttendance } from "@/lib/attendance-reconcile";

// Team-wide attendance board data for the dashboard. No longer public - every
// teammate can see every other teammate's live status, but only from inside the
// dashboard, not the open internet.
export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    try {
        await reconcileMidnightAttendance(supabase);
    } catch (error) {
        console.error("attendance board reconciliation failed", error);
        return NextResponse.json({ success: false, error: "Could not reconcile attendance." }, { status: 500 });
    }
    const { data: passes } = await supabase
        .from("overnight_passes")
        .select("member_account_id")
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString());

    // Supabase/PostgREST caps each response page, so fetch ordered chunks.
    // Cap at 5000 logs (5 pages) to keep response fast and bounded while covering months of history.
    const logs: Array<{ member_account_id: string; action: string; occurred_at: string; source: string | null }> = [];
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 5;
    for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
        const from = pageIndex * PAGE_SIZE;
        const { data, error } = await supabase
            .from("attendance_logs")
            .select("member_account_id, action, occurred_at, source")
            .order("occurred_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        if (error) {
            console.error("attendance board fetch error", error);
            return NextResponse.json({ success: false, error: "Could not load attendance." }, { status: 500 });
        }
        logs.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
    }

    const memberAccountIds = Array.from(new Set(logs.map((l) => l.member_account_id)));
    if (memberAccountIds.length === 0) {
        return NextResponse.json({ success: true, events: [], ghosts: [], overnight: [] });
    }

    const [{ data: accounts }, { data: roster }] = await Promise.all([
        supabase.from("member_accounts").select("id, name, domain").in("id", memberAccountIds),
        supabase.from("members").select("member_account_id, name, domain").in("member_account_id", memberAccountIds),
    ]);

    const rosterByAccountId = new Map((roster || []).filter((r) => r.member_account_id).map((r) => [r.member_account_id as string, r]));
    const accountById = new Map((accounts || []).map((a) => [a.id, a]));

    const identify = (memberAccountId: string) => {
        const rosterEntry = rosterByAccountId.get(memberAccountId);
        const account = accountById.get(memberAccountId);
        return {
            name: rosterEntry?.name || account?.name || "Unknown",
            domain: rosterEntry?.domain || account?.domain || "GENERAL",
        };
    };

    const events = logs.map((log) => ({
        memberAccountId: log.member_account_id,
        ...identify(log.member_account_id),
        action: log.action,
        occurredAt: log.occurred_at,
        source: log.source || "unknown",
    }));

    return NextResponse.json({
        success: true,
        events,
        overnight: (passes || []).map((p) => p.member_account_id),
    });
}
