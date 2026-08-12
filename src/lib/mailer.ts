import nodemailer from "nodemailer";
import path from "path";

export const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

export function getTransporter() {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASSWORD,
    },
  });
}

// Inline attachment for the "cid:robocon_logo" reference used by the red/black
// email templates — most mail clients strip/block remote <img> src by default,
// so the logo is shipped as a cid attachment rather than a public URL.
export function logoAttachment() {
  return {
    filename: "logo.png",
    path: path.join(process.cwd(), "public", "LOGO.png"),
    cid: "robocon_logo",
  };
}
