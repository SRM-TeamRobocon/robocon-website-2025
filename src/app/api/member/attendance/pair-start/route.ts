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
