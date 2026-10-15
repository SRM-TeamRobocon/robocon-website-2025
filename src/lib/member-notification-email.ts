import { getTransporter, logoAttachment, sendMailWithRetry, SMTP_EMAIL } from "@/lib/mailer";

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function memberNotificationHtml(name: string, title: string, message: string) {
    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#000;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #C20000;overflow:hidden;">
        <tr>
          <td style="background:#000;border-bottom:3px solid #C20000;padding:30px 40px;text-align:center;">
            <img src="cid:robocon_logo" alt="SRM Team Robocon" width="56" height="56" style="display:block;margin:0 auto 14px;" />
            <p style="margin:0 0 6px;color:#C20000;font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:700;">SRM Team Robocon</p>
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">${escapeHtml(title)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#cfcfcf;font-size:15px;line-height:1.6;margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
            <p style="color:#fff;font-size:16px;line-height:1.7;margin:0;">${escapeHtml(message)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #2a2a2a;text-align:center;">
            <p style="color:#555;font-size:11px;margin:0;">SRM Team Robocon</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendMemberNotificationEmail(
    recipients: string[],
    name: string,
    title: string,
    message: string
) {
    const transporter = getTransporter();
    const uniqueRecipients = Array.from(new Set(recipients.map((email) => email.trim().toLowerCase()).filter(Boolean)));
    if (!transporter || !SMTP_EMAIL || uniqueRecipients.length === 0) {
        if (!transporter) console.warn("Member notification email skipped - SMTP is not configured.");
        return false;
    }

    try {
        await sendMailWithRetry(transporter, {
            from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
            to: uniqueRecipients,
            subject: title,
            html: memberNotificationHtml(name, title, message),
            attachments: [logoAttachment()],
        });
        return true;
    } catch (error) {
        console.error("Member notification email failed", { recipients: uniqueRecipients, error });
        return false;
    }
}
