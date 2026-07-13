import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTransporter, SMTP_EMAIL } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const OTP_TTL_MS = 10 * 60 * 1000;
const GENERIC_MESSAGE = "If that email has an account, we've sent a reset code to it.";

function buildOtpEmailHtml(name: string, otp: string): string {
    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#e11d48,#be123c);padding:28px 36px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Reset your password</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">SRM Team Robocon — Member Login</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px;">
            <p style="color:#e0e0e0;font-size:14px;line-height:1.6;margin:0 0 20px;">
              Hi <strong style="color:#fff;">${name}</strong>,<br/>
              Use this code to reset your password. It expires in 10 minutes.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;background:#111;border-radius:10px;border:1px solid #2a2a2a;">
              <tr><td style="padding:16px 20px;text-align:center;">
                <p style="margin:0;color:#fff;font-size:28px;font-weight:700;letter-spacing:6px;">${otp}</p>
              </td></tr>
            </table>
            <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">
              If you didn't request this, ignore this email — your password won't change.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const email = String(body.email || "").trim().toLowerCase();
        if (!email) {
            return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { data: account } = await supabase
            .from("member_accounts")
            .select("id, name, email")
            .eq("email", email)
            .maybeSingle();

        if (account) {
            const otp = crypto.randomInt(100000, 1000000).toString();
            const otpHash = await bcrypt.hash(otp, 10);
            const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();

            const { error: updateError } = await supabase
                .from("member_accounts")
                .update({ reset_otp_hash: otpHash, reset_otp_expires: expires, reset_otp_attempts: 0 })
                .eq("id", account.id);

            if (updateError) {
                console.error("forgot-password otp store error", updateError);
                return NextResponse.json({ success: false, error: "Could not process request." }, { status: 500 });
            }

            const transporter = getTransporter();
            if (transporter) {
                transporter
                    .sendMail({
                        from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
                        to: account.email,
                        subject: "Password reset code — SRM Team Robocon",
                        html: buildOtpEmailHtml(account.name, otp),
                    })
                    .catch((err) => console.error("otp email failed", err));
            } else {
                console.warn("SMTP not configured — skipping OTP email");
            }
        }

        // Same response whether or not the account exists, so emails can't be enumerated.
        return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    } catch (error) {
        console.error("forgot-password error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
