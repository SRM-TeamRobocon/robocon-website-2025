import nodemailer from "nodemailer";
import path from "path";

export const SMTP_EMAIL = process.env.SMTP_FROM || process.env.SMTP_EMAIL;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

export function getTransporter() {
  if (!SMTP_EMAIL || !SMTP_USER || !SMTP_PASSWORD) return null;

  if (SMTP_HOST) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT || 587,
      secure: (SMTP_PORT || 587) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASSWORD,
    },
  });
}

// --- Recruitment mass-mail (Gmail SMTP, not Brevo) ---
// Scoped to the recruitment "Send Mail" bulk-BCC feature only. Every other email in the
// app (OTP, member approvals, ticket resolution) keeps using getTransporter() / Brevo above -
// don't repoint those here.
const RECRUIT_BULK_GMAIL_USER = process.env.SMTP_EMAIL;
const RECRUIT_BULK_GMAIL_PASSWORD = process.env.SMTP_PASSWORD_GOOGLE;

export const RECRUIT_BULK_MAIL_FROM = RECRUIT_BULK_GMAIL_USER;

export function getRecruitmentBulkMailTransporter() {
  if (!RECRUIT_BULK_GMAIL_USER || !RECRUIT_BULK_GMAIL_PASSWORD) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: RECRUIT_BULK_GMAIL_USER,
      pass: RECRUIT_BULK_GMAIL_PASSWORD,
    },
  });
}

// Inline attachment for the "cid:robocon_logo" reference used by the red/black
// email templates - most mail clients strip/block remote <img> src by default,
// so the logo is shipped as a cid attachment rather than a public URL.
export function logoAttachment() {
  return {
    filename: "logo.png",
    path: path.join(process.cwd(), "public", "LOGO.png"),
    cid: "robocon_logo",
  };
}
