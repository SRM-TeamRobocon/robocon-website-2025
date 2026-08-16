import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;

export async function POST() {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!session.memberAccountId) {
        return NextResponse.json({ success: false, error: "This login has no linked member account." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
        .from("member_accounts")
        .update({ rfid_uid: null })
        .eq("id", session.memberAccountId);

    if (error) {
        console.error("attendance unlink error", error);
        return NextResponse.json({ success: false, error: "Could not unlink card." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
