import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

// Team-wide attendance board data for the dashboard. No longer public — every
// teammate can see every other teammate's live status, but only from inside the
// dashboard, not the open internet.
export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;
const LOOKBACK_DAYS = 60;

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error: logsError } = await supabase
        .from("attendance_logs")
        .select("member_account_id, action, occurred_at")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: true });

    if (logsError) {
        console.error("attendance board fetch error", logsError);
        return NextResponse.json({ success: false, error: "Could not load attendance." }, { status: 500 });
    }

    const memberAccountIds = Array.from(new Set((logs || []).map((l) => l.member_account_id)));
    if (memberAccountIds.length === 0) {
        return NextResponse.json({ success: true, events: [] });
    }

    const [{ data: accounts }, { data: roster }] = await Promise.all([
        supabase.from("member_accounts").select("id, name, domain").in("id", memberAccountIds),
        supabase.from("members").select("member_account_id, name, domain").in("member_account_id", memberAccountIds),
    ]);

    const rosterByAccountId = new Map((roster || []).filter((r) => r.member_account_id).map((r) => [r.member_account_id as string, r]));
    const accountById = new Map((accounts || []).map((a) => [a.id, a]));

    const events = (logs || []).map((log) => {
        const rosterEntry = rosterByAccountId.get(log.member_account_id);
        const account = accountById.get(log.member_account_id);
        return {
            memberAccountId: log.member_account_id,
            name: rosterEntry?.name || account?.name || "Unknown",
            domain: rosterEntry?.domain || account?.domain || "GENERAL",
            action: log.action,
            occurredAt: log.occurred_at,
        };
    });

    return NextResponse.json({ success: true, events });
}
