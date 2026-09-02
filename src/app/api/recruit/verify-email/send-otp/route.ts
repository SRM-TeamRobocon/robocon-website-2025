import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { getRecruitSession } from "@/lib/recruit-session";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getTransporter, SMTP_EMAIL, logoAttachment } from "@/lib/mailer";
import { buildOtpHtml } from "@/lib/otp-email";

export const dynamic = "force-dynamic";

const OTP_RATE_LIMIT = 3;
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const OTP_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// crypto.randomInt, not Math.random - Math.random is a fast non-cryptographic PRNG
// whose output is predictable from prior samples, which would make OTPs guessable.
function generateOtp(): string {
    return String(randomInt(100000, 1000000));
}

// POST /api/recruit/verify-email/send-otp
// Post-registration counterpart to /api/recruit/auth/send-otp. That route ran before an
// account existed, keyed by the email typed into a signed pre-registration cookie. SRM
// email verification was moved out of the registration wizard (it's now optional, done
// later from the dashboard), so this route is keyed by the logged-in recruit's own
// recruit_token session instead of a cookie-carried email.
export async function POST() {
    try {
        const session = await getRecruitSession();
        if (!session) {
            return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
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

        // Already verified - no-op rather than an error, so a stale dashboard tab clicking
        // "Send OTP" a second time doesn't surface a confusing failure.
        if (account.srm_email_verified) {
            return NextResponse.json({ sent: true });
        }

        const srmEmail = account.srm_email as string;

        const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS).toISOString();
        const { count, error: countError } = await supabase
            .from("recruit_email_otps")
            .select("id", { count: "exact", head: true })
            .eq("srm_email", srmEmail)
            .gte("created_at", windowStart);

        if (countError) {
            console.error("verify-email send-otp rate-limit check error", countError);
            return NextResponse.json({ success: false, error: "Could not send OTP." }, { status: 500 });
        }

        if ((count ?? 0) >= OTP_RATE_LIMIT) {
            return NextResponse.json(
                { success: false, error: "Too many OTP requests. Please try again in an hour." },
                { status: 429 }
            );
        }

        // Invalidate any earlier live OTPs for this address so only the newest code works -
        // otherwise all 3 codes in the rate-limit window stay guessable simultaneously.
        await supabase
            .from("recruit_email_otps")
            .update({ used_at: new Date().toISOString() })
            .eq("srm_email", srmEmail)
            .is("used_at", null);

        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

        const { error: insertError } = await supabase.from("recruit_email_otps").insert({
            srm_email: srmEmail,
            otp_hash: otpHash,
            expires_at: expiresAt,
        });

        if (insertError) {
            console.error("verify-email send-otp insert error", insertError);
            return NextResponse.json({ success: false, error: "Could not send OTP." }, { status: 500 });
        }

        const transporter = getTransporter();
        if (transporter) {
            await transporter
                .sendMail({
                    from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
                    to: srmEmail,
                    subject: `${otp} is your SRM Team Robocon verification code`,
                    text: `Your OTP for SRM Team Robocon email verification is: ${otp}\n\nThis code expires in 15 minutes. If you did not request this, you can safely ignore this email.`,
                    html: buildOtpHtml(otp, srmEmail),
                    attachments: [logoAttachment()],
                })
                .catch((err) => console.error("verify-email otp email send failed", err));
        } else {
            console.warn("SMTP not configured - skipping OTP email (local dev)");
        }

        return NextResponse.json({ sent: true });
    } catch (error) {
        console.error("verify-email send-otp error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
