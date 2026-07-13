import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const { token } = await request.json();
        if (!token || typeof token !== "string") {
            return NextResponse.json({ success: false, error: "Missing token." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        const { data: account, error } = await supabase
            .from("member_accounts")
            .select("id, email_verified, verification_expires")
            .eq("verification_token", token)
            .maybeSingle();

        if (error || !account) {
            return NextResponse.json({ success: false, error: "Invalid or already-used verification link." }, { status: 404 });
        }

        if (account.email_verified) {
            return NextResponse.json({ success: true, alreadyVerified: true });
        }

        if (!account.verification_expires || new Date(account.verification_expires) < new Date()) {
            return NextResponse.json({ success: false, error: "This verification link has expired." }, { status: 410 });
        }

        const { error: updateError } = await supabase
            .from("member_accounts")
            .update({ email_verified: true, verification_token: null, verification_expires: null })
            .eq("id", account.id);

        if (updateError) {
            console.error("member verify update error", updateError);
            return NextResponse.json({ success: false, error: "Could not verify email." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("member verify error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
