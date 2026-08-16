import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const DASHBOARD_ROLES = ["member", "lead", "admin"] as const;

export async function GET(request: Request) {
    const session = await getSession();
    if (!requireRole(session, [...DASHBOARD_ROLES])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
        return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: pairing, error } = await supabase
        .from("rfid_pairing_requests")
        .select("status, expires_at, member_account_id")
        .eq("id", id)
        .maybeSingle();

    if (error || !pairing || pairing.member_account_id !== session.memberAccountId) {
        return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const status = pairing.status === "pending" && Date.parse(pairing.expires_at) < Date.now() ? "expired" : pairing.status;

    return NextResponse.json({ success: true, status });
}
