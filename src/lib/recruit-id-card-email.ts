interface IdCardEmailParams {
    name: string;
    regNo: string;
    year: string;
    department: string;
    domainLabels: string[];
}

export function buildIdCardHtml(params: IdCardEmailParams): string {
    const { name, regNo, year, department, domainLabels } = params;

    const domainRows = domainLabels
        .map(
            (label) => `
              <tr>
                <td style="padding:4px 0;color:#888;font-size:12px;letter-spacing:0.5px;">${label}</td>
              </tr>`
        )
        .join("");

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
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:0.5px;">Registration Confirmed</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 12px;">
              <p style="color:#cfcfcf;font-size:14px;line-height:1.6;margin:0 0 28px;text-align:center;">
                Your recruitment account has been created. This is your official ID card; present the QR code at any recruitment checkpoint.
              </p>

              <!-- ID Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;border:1px solid #C20000;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                <tr>
                  <td style="background:#C20000;height:6px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:24px 28px 8px;text-align:center;">
                    <p style="margin:0;color:#777;font-size:10px;letter-spacing:3px;text-transform:uppercase;">Recruitment Pass</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 28px;text-align:center;">
                    <img src="cid:recruit_qr" alt="Recruit QR Code" width="220" height="220" style="display:block;margin:0 auto;background:#ffffff;border-radius:8px;padding:14px;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 28px 4px;text-align:center;">
                    <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">${name}</p>
                    <p style="margin:4px 0 0;color:#999;font-size:13px;font-family:monospace;">${regNo}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 28px 22px;text-align:center;">
                    <p style="margin:0;color:#666;font-size:12px;">${department} &mdash; Year ${year}</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#C20000;height:6px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#140000;border:1px solid #C20000;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Domains Applied</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${domainRows}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color:#666;font-size:12px;line-height:1.6;margin:0 0 24px;text-align:center;">
                Keep this email safe; the QR code above is unique to your account and will be scanned at every stage of recruitment.
              </p>
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
