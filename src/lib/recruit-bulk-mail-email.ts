// HTML template for admin-composed bulk emails to recruits (Send Mail page). Subject/body
// are admin-supplied free text, so everything user-controlled is escaped before being
// interpolated — this renders in the recipient's mail client, but a lead's own account
// could otherwise be turned into a stored-XSS vector against the composer they reuse later.
function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/FesAdolZdhvFsuRRUOiMa8?s=sw&p=a&ilr=0";
const WEBSITE_URL = "https://www.srmteamrobocon.com";

interface BulkMailParams {
    subject: string;
    message: string;
    eventLabel: string | null;
}

export function buildBulkMailHtml(params: BulkMailParams): string {
    const { subject, message, eventLabel } = params;
    const bodyHtml = escapeHtml(message).replace(/\n/g, "<br/>");

    const eventBlock = eventLabel
        ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#140000;border:1px solid #C20000;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;text-align:center;">
                    <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Date &amp; Time</p>
                    <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0;">${escapeHtml(eventLabel)}</p>
                  </td>
                </tr>
              </table>`
        : "";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#000000;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:12px;border:1px solid #C20000;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#000000;border-bottom:3px solid #C20000;padding:32px 40px;text-align:center;">
              <img src="cid:robocon_logo" alt="SRM Team Robocon" width="56" height="56" style="display:block;margin:0 auto 14px;" />
              <p style="margin:0 0 6px;color:#C20000;font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:700;">SRM Team Robocon</p>
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px;">${escapeHtml(subject)}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 12px;">
              <p style="color:#cfcfcf;font-size:14px;line-height:1.6;margin:0 0 20px;">Dear Applicant,</p>
              <p style="color:#cfcfcf;font-size:14px;line-height:1.6;margin:0 0 24px;">${bodyHtml}</p>
              ${eventBlock}

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                <tr>
                  <td align="center">
                    <a href="${WHATSAPP_GROUP_LINK}" target="_blank" style="display:inline-block;background:#25D366;color:#0a0a0a;font-size:15px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">
                      Join WhatsApp Group
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #2a2a2a;text-align:center;">
              <p style="margin:0 0 8px;">
                <a href="${WEBSITE_URL}" target="_blank" style="color:#C20000;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">www.srmteamrobocon.com</a>
              </p>
              <p style="color:#555;font-size:11px;margin:0;">© ${new Date().getFullYear()} SRM Team Robocon. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
