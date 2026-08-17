import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import type { GhostStat } from "@/lib/attendance";

// Team-wide attendance board data for the dashboard. No longer public — every
// teammate can see every other teammate's live status, but only from inside the
// dashboard, not the open internet.
export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;
const LOOKBACK_DAYS = 60;
// Ghost counts are all-time (unlike the 60-day session window), so this cap is what
// keeps an unbounded scan off the table. Only auto_checkout rows match, so it's a
// small slice — one row per forgotten tap-out, team-wide.
const GHOST_ROW_CAP = 5000;

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: logs, error: logsError }, { data: ghostLogs }, { data: passes }] = await Promise.all([
        supabase
            .from("attendance_logs")
            .select("member_account_id, action, occurred_at")
            .gte("occurred_at", since)
            .order("occurred_at", { ascending: true }),
        supabase
            .from("attendance_logs")
            .select("member_account_id, occurred_at")
            .eq("source", "auto_checkout")
            .order("occurred_at", { ascending: false })
            .limit(GHOST_ROW_CAP),
        supabase
            .from("overnight_passes")
            .select("member_account_id")
            .eq("status", "active")
            .gt("expires_at", new Date().toISOString()),
    ]);

    if (logsError) {
        console.error("attendance board fetch error", logsError);
        return NextResponse.json({ success: false, error: "Could not load attendance." }, { status: 500 });
    }

    // Ghosts are all-time while `logs` is a 60-day window, so someone can appear on the
    // ghost board without any recent taps — resolve names across the union of both.
    const memberAccountIds = Array.from(
        new Set([...(logs || []).map((l) => l.member_account_id), ...(ghostLogs || []).map((l) => l.member_account_id)])
    );
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

    const events = (logs || []).map((log) => ({
        memberAccountId: log.member_account_id,
        ...identify(log.member_account_id),
        action: log.action,
        occurredAt: log.occurred_at,
    }));

    // ghostLogs is ordered newest-first, so the first row seen per member is their
    // most recent forgotten tap-out.
    const ghostByMember = new Map<string, GhostStat>();
    for (const log of ghostLogs || []) {
        const existing = ghostByMember.get(log.member_account_id);
        if (existing) {
            existing.count += 1;
        } else {
            ghostByMember.set(log.member_account_id, {
                memberAccountId: log.member_account_id,
                ...identify(log.member_account_id),
                count: 1,
                lastAt: log.occurred_at,
            });
        }
    }
    const ghosts = Array.from(ghostByMember.values()).sort(
        (a, b) => b.count - a.count || Date.parse(b.lastAt) - Date.parse(a.lastAt)
    );

    return NextResponse.json({
        success: true,
        events,
        ghosts,
        overnight: (passes || []).map((p) => p.member_account_id),
    });
}
