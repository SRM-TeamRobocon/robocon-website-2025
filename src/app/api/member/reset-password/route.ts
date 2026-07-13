import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptPassword } from "@/lib/password-enc";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const email = String(body.email || "").trim().toLowerCase();
        const otp = String(body.otp || "").trim();
        const newPassword = String(body.newPassword || "");

        if (!email || !otp || !newPassword) {
            return NextResponse.json({ success: false, error: "Fill in all fields." }, { status: 400 });
        }
        if (newPassword.length < 8) {
            return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data: account } = await supabase
            .from("member_accounts")
            .select("id, reset_otp_hash, reset_otp_expires, reset_otp_attempts")
            .eq("email", email)
            .maybeSingle();

        if (!account || !account.reset_otp_hash || !account.reset_otp_expires) {
            return NextResponse.json({ success: false, error: "Invalid or expired code. Request a new one." }, { status: 400 });
        }

        if (new Date(account.reset_otp_expires) < new Date()) {
            return NextResponse.json({ success: false, error: "This code has expired. Request a new one." }, { status: 410 });
        }

        if (account.reset_otp_attempts >= MAX_ATTEMPTS) {
            return NextResponse.json({ success: false, error: "Too many attempts. Request a new code." }, { status: 429 });
        }

        const otpMatches = await bcrypt.compare(otp, account.reset_otp_hash);
        if (!otpMatches) {
            await supabase
                .from("member_accounts")
                .update({ reset_otp_attempts: account.reset_otp_attempts + 1 })
                .eq("id", account.id);
            return NextResponse.json({ success: false, error: "Incorrect code." }, { status: 401 });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        const passwordEnc = encryptPassword(newPassword);

        const { error: updateError } = await supabase
            .from("member_accounts")
            .update({
                password_hash: passwordHash,
                password_enc: passwordEnc,
                reset_otp_hash: null,
                reset_otp_expires: null,
                reset_otp_attempts: 0,
            })
            .eq("id", account.id);

        if (updateError) {
            console.error("reset-password update error", updateError);
            return NextResponse.json({ success: false, error: "Could not reset password." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("reset-password error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
