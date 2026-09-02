import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Legacy env-based staff (LEAD_ACCOUNTS) have no member_accounts row, so Google
// connect doesn't apply to them - the dashboard hides the section on a 403 here.
export async function GET() {
    const session = await getSession();
    if (!session || !session.memberAccountId) {
        return NextResponse.json({ success: false, error: "Not applicable" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
        .from("member_accounts")
        .select("google_email")
        .eq("id", session.memberAccountId)
        .maybeSingle();

    return NextResponse.json({
        success: true,
        connected: Boolean(data?.google_email),
        email: data?.google_email ?? null,
    });
}
