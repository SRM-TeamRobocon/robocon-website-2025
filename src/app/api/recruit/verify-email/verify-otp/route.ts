import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getRecruitSession } from "@/lib/recruit-session";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";

export const dynamic = "force-dynamic";

// Burn the OTP after this many wrong guesses. Without a cap, the 6-digit keyspace is
// brute-forceable inside the 15-minute window (bcrypt cost 10 is the only brake, and
// requests run concurrently). Same cap as src/app/api/recruit/auth/verify-otp/route.ts.
const MAX_OTP_ATTEMPTS = 5;

// POST /api/recruit/verify-email/verify-otp
// Post-registration counterpart to /api/recruit/auth/verify-otp - see send-otp/route.ts
// in this directory for why this pair exists separately from the pre-registration one.
export async function POST(request: Request) {
    try {
        const session = await getRecruitSession();
        if (!session) {
            return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
        }

        const body = await request.json();
        const otp = String(body.otp || "").trim();
        if (!otp) {
            return NextResponse.json({ success: false, error: "Missing OTP." }, { status: 400 });
        }

        const supabase = createRecruitSupabaseAdminClient();

        const { data: account, error: accountError } = await supabase
            .from("recruit_accounts")
            .select("srm_email, srm_email_verified")
            .eq("id", session.recruit_id)
            .maybeSingle();

        if (accountError || !account) {
            return NextResponse.json({ success: false, error: "Recruit account not found" }, { status: 404 });
        }

        if (account.srm_email_verified) {
            return NextResponse.json({ verified: true });
        }

        const srmEmail = account.srm_email as string;

        const { data: otpRow, error: fetchError } = await supabase
            .from("recruit_email_otps")
            .select("id, otp_hash, expires_at, used_at, attempts")
            .eq("srm_email", srmEmail)
            .is("used_at", null)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError || !otpRow) {
            return NextResponse.json({ success: false, error: "OTP expired or not found" }, { status: 400 });
        }

        if ((otpRow.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
            await supabase
                .from("recruit_email_otps")
                .update({ used_at: new Date().toISOString() })
                .eq("id", otpRow.id);
            return NextResponse.json(
                { success: false, error: "Too many incorrect attempts. Request a new OTP." },
                { status: 429 }
            );
        }

        const matches = await bcrypt.compare(otp, otpRow.otp_hash);
        if (!matches) {
            await supabase
                .from("recruit_email_otps")
                .update({ attempts: (otpRow.attempts ?? 0) + 1 })
                .eq("id", otpRow.id);
            return NextResponse.json({ success: false, error: "Invalid OTP" }, { status: 400 });
        }

        const { error: updateOtpError } = await supabase
            .from("recruit_email_otps")
            .update({ used_at: new Date().toISOString() })
            .eq("id", otpRow.id);

        if (updateOtpError) {
            console.error("verify-email verify-otp mark-used error", updateOtpError);
            return NextResponse.json({ success: false, error: "Could not verify OTP." }, { status: 500 });
        }

        const { error: updateAccountError } = await supabase
            .from("recruit_accounts")
            .update({ srm_email_verified: true })
            .eq("id", session.recruit_id);

        if (updateAccountError) {
            console.error("verify-email verify-otp account update error", updateAccountError);
            return NextResponse.json({ success: false, error: "Could not verify OTP." }, { status: 500 });
        }

        return NextResponse.json({ verified: true });
    } catch (error) {
        console.error("verify-email verify-otp error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
