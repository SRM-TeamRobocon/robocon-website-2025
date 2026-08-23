// HTML template for the email a recruit gets when their support ticket is resolved.
// message/resolutionNote are recruit- and lead-authored free text respectively, so both
// are escaped before interpolation — same reasoning as buildBulkMailHtml: this renders in
// the recipient's mail client, and a ticket is something anyone can submit pre-approval.
function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

interface TicketResolvedParams {
    name: string;
    message: string;
    resolutionNote: string;
    domainChange: { from: string; to: string } | null;
}

export function buildTicketResolvedHtml(params: TicketResolvedParams): string {
    const { name, message, resolutionNote, domainChange } = params;
    const questionHtml = escapeHtml(message).replace(/\n/g, "<br/>");
    const answerHtml = escapeHtml(resolutionNote).replace(/\n/g, "<br/>");

    const domainBlock = domainChange
        ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#140000;border:1px solid #C20000;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;text-align:center;">
                    <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Domain Switched</p>
                    <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0;">${escapeHtml(domainChange.from)} &rarr; ${escapeHtml(domainChange.to)}</p>
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
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px;">Your Ticket Has Been Resolved</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 12px;">
              <p style="color:#cfcfcf;font-size:14px;line-height:1.6;margin:0 0 24px;">Hi ${escapeHtml(name)}, a lead has responded to the ticket you raised. Here's a summary:</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="padding:16px 20px;background:#111111;border:1px solid #2a2a2a;border-radius:8px;">
                    <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Your Question</p>
                    <p style="color:#cfcfcf;font-size:14px;line-height:1.6;margin:0;">${questionHtml}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;background:#140000;border:1px solid #C20000;border-radius:8px;">
                    <p style="color:#ff9a9a;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Our Answer</p>
                    <p style="color:#ffffff;font-size:14px;line-height:1.6;margin:0;">${answerHtml}</p>
                  </td>
                </tr>
              </table>

              ${domainBlock}

              <p style="color:#666;font-size:12px;line-height:1.6;margin:8px 0 0;">Still have questions? Raise a new ticket from your dashboard any time.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #2a2a2a;text-align:center;">
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
