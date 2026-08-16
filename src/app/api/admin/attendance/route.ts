import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { normalizeRfidUid } from "@/lib/attendance";

export const dynamic = "force-dynamic";

// Manual escape hatch for cases self-service pairing can't reach: lost-card
// replacement, or legacy LEAD_ACCOUNTS logins that have no member_accounts row of
// their own to pair from. Not the primary flow — self-service pairing is.
export async function PATCH(request: Request) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let body: { memberAccountId?: string; rfidUid?: string | null };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    if (!body.memberAccountId) {
        return NextResponse.json({ success: false, error: "Missing memberAccountId." }, { status: 400 });
    }

    const rfidUid = body.rfidUid ? normalizeRfidUid(body.rfidUid) : null;

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
        .from("member_accounts")
        .update({ rfid_uid: rfidUid })
        .eq("id", body.memberAccountId);

    if (error) {
        console.error("admin attendance bind error", error);
        return NextResponse.json({ success: false, error: "This card may already be linked to another account." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
