import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { buildSessions, type AttendanceEvent } from "@/lib/attendance";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;
const OPEN_SESSION_NUDGE_MS = 60 * 60 * 1000; // prompt "forgot to tap out?" after 1h still IN

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!session.memberAccountId) {
        return NextResponse.json({ success: true, linked: false, cardTail: null, sessions: [], openSince: null, overnight: null });
    }

    const supabase = createSupabaseAdminClient();

    const [{ data: account }, { data: logs }, { data: pass }] = await Promise.all([
        supabase.from("member_accounts").select("rfid_uid, name, domain").eq("id", session.memberAccountId).maybeSingle(),
        supabase
            .from("attendance_logs")
            .select("action, occurred_at")
            .eq("member_account_id", session.memberAccountId)
            .order("occurred_at", { ascending: false })
            .limit(60),
        supabase
            .from("overnight_passes")
            .select("id, night_of, reason, expires_at")
            .eq("member_account_id", session.memberAccountId)
            .eq("status", "active")
            .gt("expires_at", new Date().toISOString())
            .maybeSingle(),
    ]);

    const name = session.name || account?.name || "You";
    const domain = session.domain || account?.domain || "GENERAL";
    const events: AttendanceEvent[] = (logs || [])
        .slice()
        .reverse()
        .map((l) => ({ memberAccountId: session.memberAccountId!, name, domain, action: l.action as "IN" | "OUT", occurredAt: l.occurred_at }));

    const sessions = buildSessions(events, Date.now()).slice(0, 20);
    const openSession = sessions.find((s) => s.outAt === null) || null;
    // Holding an overnight pass means the long open session is intentional, so don't
    // nag them about a tap-out they haven't forgotten.
    const openTooLong =
        openSession && !pass && Date.now() - Date.parse(openSession.inAt) > OPEN_SESSION_NUDGE_MS ? openSession.inAt : null;

    return NextResponse.json({
        success: true,
        linked: Boolean(account?.rfid_uid),
        cardTail: account?.rfid_uid ? account.rfid_uid.slice(-4) : null,
        sessions,
        openSince: openTooLong,
        overnight: pass ? { id: pass.id, nightOf: pass.night_of, reason: pass.reason, expiresAt: pass.expires_at } : null,
    });
}
