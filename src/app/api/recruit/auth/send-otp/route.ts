import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getTransporter, SMTP_EMAIL, logoAttachment } from "@/lib/mailer";
import { buildOtpHtml } from "@/lib/otp-email";

export const dynamic = "force-dynamic";

const SRM_EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@srmist\.edu\.in$/;
const OTP_RATE_LIMIT = 3;
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const OTP_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// crypto.randomInt, not Math.random — Math.random is a fast non-cryptographic PRNG
// whose output is predictable from prior samples, which would make OTPs guessable.
function generateOtp(): string {
    return String(randomInt(100000, 1000000));
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const srmEmail = String(body.srm_email || "").trim().toLowerCase();

        if (!SRM_EMAIL_RE.test(srmEmail)) {
            return NextResponse.json({ success: false, error: "Use a valid @srmist.edu.in email." }, { status: 400 });
        }

        const supabase = createRecruitSupabaseAdminClient();

        const { data: cycle } = await supabase
            .from("recruitment_cycles")
            .select("id")
            .eq("is_active", true)
            .maybeSingle();

        if (!cycle) {
            return NextResponse.json({ success: false, error: "Registrations not open" }, { status: 503 });
        }

        const { data: existingAccount } = await supabase
            .from("recruit_accounts")
            .select("id")
            .eq("srm_email", srmEmail)
            .eq("srm_email_verified", true)
            .eq("cycle_id", cycle.id)
            .maybeSingle();

        // Deliberately NOT a distinct "already registered" response: that turns this
        // unauthenticated endpoint into a registration-status oracle over the guessable
        // ab1234@srmist.edu.in space. Return the same shape as a successful send and
        // simply don't send mail.
        if (existingAccount) {
            return NextResponse.json({ sent: true });
        }

        const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS).toISOString();
        const { count, error: countError } = await supabase
            .from("recruit_email_otps")
            .select("id", { count: "exact", head: true })
            .eq("srm_email", srmEmail)
            .gte("created_at", windowStart);

        if (countError) {
            console.error("send-otp rate-limit check error", countError);
            return NextResponse.json({ success: false, error: "Could not send OTP." }, { status: 500 });
        }

        if ((count ?? 0) >= OTP_RATE_LIMIT) {
            return NextResponse.json(
                { success: false, error: "Too many OTP requests. Please try again in an hour." },
                { status: 429 }
            );
        }

        // Invalidate any earlier live OTPs for this address so only the newest code works —
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
            console.error("send-otp insert error", insertError);
            return NextResponse.json({ success: false, error: "Could not send OTP." }, { status: 500 });
        }

        const transporter = getTransporter();
        if (transporter) {
            await transporter
                .sendMail({
                    from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
                    to: srmEmail,
                    subject: `${otp} is your SRM Team Robocon verification code`,
                    text: `Your OTP for SRM Team Robocon recruitment registration is: ${otp}\n\nThis code expires in 15 minutes. If you did not request this, you can safely ignore this email.`,
                    html: buildOtpHtml(otp, srmEmail),
                    attachments: [logoAttachment()],
                })
                .catch((err) => console.error("otp email send failed", err));
        } else {
            console.warn("SMTP not configured — skipping OTP email (local dev)");
        }

        return NextResponse.json({ sent: true });
    } catch (error) {
        console.error("send-otp error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
