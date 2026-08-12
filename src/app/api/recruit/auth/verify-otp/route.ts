import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import {
    signOAuthState,
    verifyOAuthState,
    OAUTH_STATE_COOKIE,
    OAUTH_STATE_COOKIE_OPTIONS,
} from "@/lib/recruit-session";

export const dynamic = "force-dynamic";

// Burn the OTP after this many wrong guesses. Without a cap, the 6-digit keyspace is
// brute-forceable inside the 15-minute window (bcrypt cost 10 is the only brake, and
// requests run concurrently).
const MAX_OTP_ATTEMPTS = 5;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const srmEmail = String(body.srm_email || "").trim().toLowerCase();
        const otp = String(body.otp || "").trim();

        if (!srmEmail || !otp) {
            return NextResponse.json({ success: false, error: "Missing email or OTP." }, { status: 400 });
        }

        // The Google step is mandatory (02-AUTH.md step 1). Requiring an existing
        // oauth_state with a google_uid stops anyone from registering with OTP alone,
        // which would bypass the one-Google-account-per-person link entirely.
        const cookieStore = await cookies();
        const statePayload = await verifyOAuthState(cookieStore.get(OAUTH_STATE_COOKIE)?.value);

        if (!statePayload?.google_uid) {
            return NextResponse.json(
                { success: false, error: "Start with Google sign-in before verifying your SRM email." },
                { status: 401 }
            );
        }

        const supabase = createRecruitSupabaseAdminClient();

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

        const { error: updateError } = await supabase
            .from("recruit_email_otps")
            .update({ used_at: new Date().toISOString() })
            .eq("id", otpRow.id);

        if (updateError) {
            console.error("verify-otp mark-used error", updateError);
            return NextResponse.json({ success: false, error: "Could not verify OTP." }, { status: 500 });
        }

        const newStateToken = await signOAuthState({
            ...statePayload,
            srm_email: srmEmail,
            srm_verified: true,
        });

        const response = NextResponse.json({ verified: true });
        response.cookies.set({ name: OAUTH_STATE_COOKIE, value: newStateToken, ...OAUTH_STATE_COOKIE_OPTIONS });
        return response;
    } catch (error) {
        console.error("verify-otp error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
