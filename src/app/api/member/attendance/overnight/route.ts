import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { OVERNIGHT_PASS_TTL_MS, istNightOf } from "@/lib/attendance";

// Self-service "I'm staying overnight" pass. Claiming one exempts you from exactly
// the next midnight auto-checkout sweep (see /api/attendance/auto-checkout), so an
// all-nighter isn't recorded as a forgotten tap-out. No lead approval - the whole
// point is that it works at 2am.
export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;
const MAX_REASON_LENGTH = 200;

export async function POST(request: Request) {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!session.memberAccountId) {
        return NextResponse.json({ success: false, error: "No member account linked to this login." }, { status: 400 });
    }

    let reason: string | null = null;
    try {
        const body = await request.json();
        reason = body?.reason ? String(body.reason).trim().slice(0, MAX_REASON_LENGTH) || null : null;
    } catch {
        // Body is optional - a bare POST with no reason is the common case.
    }

    const supabase = createSupabaseAdminClient();
    const now = Date.now();

    const { data: pass, error } = await supabase
        .from("overnight_passes")
        .insert({
            member_account_id: session.memberAccountId,
            night_of: istNightOf(now),
            reason,
            expires_at: new Date(now + OVERNIGHT_PASS_TTL_MS).toISOString(),
        })
        .select("id, night_of, reason, expires_at")
        .single();

    if (error) {
        // Unique violation on overnight_passes_one_active_idx = they already have a
        // live pass (double-click, second tab). That's the state they asked for, so
        // hand back the existing one instead of an error.
        if (error.code === "23505") {
            const { data: existing } = await supabase
                .from("overnight_passes")
                .select("id, night_of, reason, expires_at")
                .eq("member_account_id", session.memberAccountId)
                .eq("status", "active")
                .maybeSingle();
            if (existing) {
                return NextResponse.json({ success: true, pass: serializePass(existing) });
            }
        }
        console.error("overnight pass: insert failed", error);
        return NextResponse.json({ success: false, error: "Could not start your overnight pass." }, { status: 500 });
    }

    return NextResponse.json({ success: true, pass: serializePass(pass) });
}

export async function DELETE() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!session.memberAccountId) {
        return NextResponse.json({ success: false, error: "No member account linked to this login." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
        .from("overnight_passes")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("member_account_id", session.memberAccountId)
        .eq("status", "active");

    if (error) {
        console.error("overnight pass: cancel failed", error);
        return NextResponse.json({ success: false, error: "Could not cancel your overnight pass." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

function serializePass(row: { id: string; night_of: string; reason: string | null; expires_at: string }) {
    return { id: row.id, nightOf: row.night_of, reason: row.reason, expiresAt: row.expires_at };
}
