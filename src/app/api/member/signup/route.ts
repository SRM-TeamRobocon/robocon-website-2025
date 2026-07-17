import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTransporter, SMTP_EMAIL } from "@/lib/mailer";
import { MEMBER_DOMAINS } from "@/constants/constants";
import { encryptPassword } from "@/lib/password-enc";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@srmist\.edu\.in$/i;
const DOMAIN_SET: readonly string[] = MEMBER_DOMAINS;

function buildVerificationEmailHtml(name: string, link: string): string {
    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#e11d48,#be123c);padding:28px 36px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Verify your email</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">SRM Team Robocon — Member Login</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px;">
            <p style="color:#e0e0e0;font-size:14px;line-height:1.6;margin:0 0 20px;">
              Hi <strong style="color:#fff;">${name}</strong>,<br/>
              Confirm this email address to continue creating your member account. This link expires in 24 hours.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
              <tr><td style="border-radius:10px;background:#e11d48;">
                <a href="${link}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Verify Email</a>
              </td></tr>
            </table>
            <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">
              After verifying, an admin still needs to approve your account before you can log in. If you didn't request this, ignore this email.
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
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const domain = String(body.domain || "").trim().toUpperCase();
        const regNo = String(body.regNo || "").trim();
        const department = String(body.department || "").trim();
        const course = String(body.course || "").trim();
        const phone = body.phone ? String(body.phone).trim() : null;
        const password = String(body.password || "");

        if (!name || !email || !domain || !regNo || !department || !course || !password) {
            return NextResponse.json({ success: false, error: "Fill in all required fields." }, { status: 400 });
        }
        if (!EMAIL_RE.test(email)) {
            return NextResponse.json({ success: false, error: "Use your @srmist.edu.in email." }, { status: 400 });
        }
        if (!DOMAIN_SET.includes(domain)) {
            return NextResponse.json({ success: false, error: "Invalid domain selected." }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        const { data: existing } = await supabase
            .from("member_accounts")
            .select("id, email_verified")
            .eq("email", email)
            .maybeSingle();

        if (existing) {
            if (existing.email_verified) {
                return NextResponse.json({ success: false, error: "An account with this email already exists." }, { status: 409 });
            }
            // Never verified (mail may have failed to send, or link expired) — the email
            // isn't "used" yet, so let this attempt replace the stale unverified row.
            const { error: deleteError } = await supabase.from("member_accounts").delete().eq("id", existing.id);
            if (deleteError) {
                console.error("member signup stale-row delete error", deleteError);
                return NextResponse.json({ success: false, error: "Could not create account." }, { status: 500 });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const passwordEnc = encryptPassword(password);
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { error: insertError } = await supabase.from("member_accounts").insert({
            name,
            email,
            domain,
            reg_no: regNo,
            department,
            course,
            phone,
            password_hash: passwordHash,
            password_enc: passwordEnc,
            verification_token: verificationToken,
            verification_expires: verificationExpires,
        });

        if (insertError) {
            console.error("member signup insert error", insertError);
            return NextResponse.json({ success: false, error: "Could not create account." }, { status: 500 });
        }

        const origin = new URL(request.url).origin;
        const verifyLink = `${origin}/verify?token=${verificationToken}`;

        const transporter = getTransporter();
        if (transporter) {
            await transporter
                .sendMail({
                    from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
                    to: email,
                    subject: "Verify your email — SRM Team Robocon Member Login",
                    html: buildVerificationEmailHtml(name, verifyLink),
                })
                .catch((err) => console.error("verification email failed", err));
        } else {
            console.warn("SMTP not configured — skipping verification email");
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("member signup error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
