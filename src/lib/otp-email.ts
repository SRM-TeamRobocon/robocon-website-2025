export function buildOtpHtml(otp: string, srmEmail: string): string {
    const digits = otp.split("");
    const digitCells = digits
        .map(
            (d) => `
              <td style="padding:0 5px;">
                <table cellpadding="0" cellspacing="0" style="background:#000000;border:1px solid #C20000;border-radius:8px;">
                  <tr>
                    <td style="width:44px;height:56px;text-align:center;vertical-align:middle;color:#ffffff;font-family:'Courier New',monospace;font-size:28px;font-weight:800;">
                      ${d}
                    </td>
                  </tr>
                </table>
              </td>`
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
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:0.5px;">Verify Your Email</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="color:#cfcfcf;font-size:15px;line-height:1.6;margin:0 0 8px;text-align:center;">
                Recruitment registration for
              </p>
              <p style="color:#ff3b3b;font-size:14px;line-height:1.6;margin:0 0 28px;text-align:center;font-family:monospace;font-weight:700;">
                ${srmEmail}
              </p>

              <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;text-align:center;">Your One-Time Passcode</p>

              <!-- OTP Digits -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  ${digitCells}
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#140000;border:1px solid #C20000;border-radius:8px;margin-bottom:8px;">
                <tr>
                  <td style="padding:14px 20px;text-align:center;">
                    <p style="color:#ff9a9a;font-size:13px;margin:0;">Expires in <strong style="color:#fff;">15 minutes</strong> &nbsp;&mdash;&nbsp; one-time use only</p>
                  </td>
                </tr>
              </table>

              <p style="color:#666;font-size:12px;line-height:1.6;margin:24px 0 0;text-align:center;">
                Didn't request this? You can safely ignore this email; no account changes were made.
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
