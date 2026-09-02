import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { PAIRING_WINDOW_MS } from "@/lib/attendance";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;

export async function POST() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!session.memberAccountId) {
        return NextResponse.json(
            { success: false, error: "This login has no linked member account, so it can't pair an RFID card." },
            { status: 400 }
        );
    }

    const supabase = createSupabaseAdminClient();

    const { data: account } = await supabase
        .from("member_accounts")
        .select("rfid_uid")
        .eq("id", session.memberAccountId)
        .maybeSingle();
    if (account?.rfid_uid) {
        return NextResponse.json(
            { success: false, error: "You already have a card linked. Unlink it first to pair a new one." },
            { status: 400 }
        );
    }

    // Only one active pairing session per member at a time.
    await supabase
        .from("rfid_pairing_requests")
        .update({ status: "cancelled" })
        .eq("member_account_id", session.memberAccountId)
        .eq("status", "pending");

    // ...and only one team-wide. The tap route can't tell whose card just touched the
    // reader - it binds the oldest open window to whatever UID arrives. With two
    // windows open, the first card tapped is bound to the wrong person, silently:
    // both dashboards report success and every later tap logs attendance for someone
    // else. Serialising here is what makes that impossible, so don't relax it to a
    // per-member check without giving the tap route another way to identify the tapper.
    const { data: otherPending } = await supabase
        .from("rfid_pairing_requests")
        .select("id")
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .neq("member_account_id", session.memberAccountId)
        .limit(1)
        .maybeSingle();

    if (otherPending) {
        return NextResponse.json(
            {
                success: false,
                error: "Someone else is pairing a card right now. Try again in a minute.",
            },
            { status: 409 }
        );
    }

    const expiresAt = new Date(Date.now() + PAIRING_WINDOW_MS).toISOString();
    const { data, error } = await supabase
        .from("rfid_pairing_requests")
        .insert({ member_account_id: session.memberAccountId, expires_at: expiresAt })
        .select("id, expires_at")
        .single();

    if (error) {
        console.error("pair-start error", error);
        return NextResponse.json({ success: false, error: "Could not start pairing." }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id, expiresAt: data.expires_at });
}
