import { SMTP_EMAIL, getTransporter } from "./mailer";

const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL;

interface RegistrationDetails {
    formData: Record<string, string>;
    paymentId: string;
    orderId: string;
}

function buildParticipantHtml(details: RegistrationDetails): string {
    const { formData, paymentId, orderId } = details;
    const workshop = formData.Workshop || "Workshop";
    const name = formData.Name || "Participant";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#e11d48,#be123c);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Registration Confirmed! 🎉</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">SRM Team Robocon — ${workshop}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="color:#e0e0e0;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Hi <strong style="color:#fff;">${name}</strong>,<br/>
                Thank you for registering for the <strong style="color:#f472b6;">${workshop} Workshop</strong>. Your payment has been verified and your spot is confirmed!
              </p>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #333;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Registration Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#999;font-size:13px;padding:4px 0;" width="40%">Name</td>
                        <td style="color:#fff;font-size:13px;padding:4px 0;">${name}</td>
                      </tr>
                      <tr>
                        <td style="color:#999;font-size:13px;padding:4px 0;">Reg. Number</td>
                        <td style="color:#fff;font-size:13px;padding:4px 0;">${formData.FullRegistrationNumber || "—"}</td>
                      </tr>
                      <tr>
                        <td style="color:#999;font-size:13px;padding:4px 0;">Department</td>
                        <td style="color:#fff;font-size:13px;padding:4px 0;">${formData.Department || "—"}</td>
                      </tr>
                      <tr>
                        <td style="color:#999;font-size:13px;padding:4px 0;">Workshop</td>
                        <td style="color:#fff;font-size:13px;padding:4px 0;">${workshop}</td>
                      </tr>
                      ${paymentId.startsWith("UTR-") ? `
                      <tr>
                        <td style="color:#999;font-size:13px;padding:4px 0;">Transaction ID</td>
                        <td style="color:#f472b6;font-size:13px;padding:4px 0;font-family:monospace;">${paymentId.replace("UTR-", "")}</td>
                      </tr>
                      ` : `
                      <tr>
                        <td style="color:#999;font-size:13px;padding:4px 0;">Payment ID</td>
                        <td style="color:#f472b6;font-size:13px;padding:4px 0;font-family:monospace;">${paymentId}</td>
                      </tr>
                      <tr>
                        <td style="color:#999;font-size:13px;padding:4px 0;">Order ID</td>
                        <td style="color:#f472b6;font-size:13px;padding:4px 0;font-family:monospace;">${orderId}</td>
                      </tr>
                      `}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What's Next -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(225,29,72,0.08);border:1px solid rgba(225,29,72,0.15);border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="color:#f472b6;font-size:13px;font-weight:600;margin:0 0 8px;">📋 What's Next?</p>
                    <ul style="color:#ccc;font-size:13px;line-height:1.8;margin:0;padding-left:18px;">
                      <li>Join the WhatsApp group (link coming soon)</li>
                      <li>Show up with your laptop and enthusiasm!</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="color:#888;font-size:13px;line-height:1.6;margin:0;">
                Questions? Reach out on Instagram 
                <a href="https://www.instagram.com/srmteamrobocon/" style="color:#f472b6;text-decoration:none;font-weight:600;">@srmteamrobocon</a>
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

function buildOrganizerText(details: RegistrationDetails): string {
    const { formData, paymentId, orderId } = details;
    const timestamp = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
    });

    return `
🆕 New Workshop Registration

Workshop:    ${formData.Workshop || "—"}
Name:        ${formData.Name || "—"}
Reg. Number: ${formData.FullRegistrationNumber || "—"}
Department:  ${formData.Department || "—"}
Email:       ${formData.YourEmail || "—"}
SRM Email:   ${formData.OfficialSRMEmailID || "—"}
Contact:     ${formData.ContactNumber || "—"}
WhatsApp:    ${formData.WhatsAppNumber || "—"}
Hostel:      ${formData.Hostel || "—"}
Room:        ${formData.Room || "—"}

${paymentId.startsWith("UTR-") ? `Transaction ID: ${paymentId.replace("UTR-", "")}` : `Payment ID:  ${paymentId}\nOrder ID:    ${orderId}`}
Timestamp:   ${timestamp}
`.trim();
}

export async function sendConfirmationEmails(
    details: RegistrationDetails
): Promise<void> {
    const participantEmail =
        details.formData.OfficialSRMEmailID || details.formData.YourEmail;
    if (!participantEmail) {
        console.warn("⚠️ No participant email found — skipping emails");
        return;
    }

    const workshop = details.formData.Workshop || "Workshop";
    const transporter = getTransporter();
    if (!transporter) {
        console.warn("⚠️ SMTP credentials not configured — skipping confirmation emails");
        return;
    }

    const participantMailOptions = {
        from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
        to: participantEmail,
        subject: `✅ Registration Confirmed — ${workshop} Workshop | SRM Team Robocon`,
        html: buildParticipantHtml(details),
    };

    const promises = [
        transporter
            .sendMail(participantMailOptions)
            .then(() =>
                console.log(`📧 Confirmation email sent to ${participantEmail}`)
            )
            .catch((err) =>
                console.error(
                    `❌ Failed to send participant email to ${participantEmail}:`,
                    err.message
                )
            ),
    ];

    // Send organizer notification if configured
    if (ORGANIZER_EMAIL) {
        const organizerMailOptions = {
            from: `"Robocon Registration Bot" <${SMTP_EMAIL}>`,
            to: ORGANIZER_EMAIL,
            subject: `🆕 New Registration: ${details.formData.Name || "Unknown"} — ${workshop}`,
            text: buildOrganizerText(details),
        };

        promises.push(
            transporter
                .sendMail(organizerMailOptions)
                .then(() =>
                    console.log(
                        `📧 Organizer notification sent to ${ORGANIZER_EMAIL}`
                    )
                )
                .catch((err) =>
                    console.error(
                        `❌ Failed to send organizer email:`,
                        err.message
                    )
                )
        );
    }

    await Promise.allSettled(promises);
    console.log("✅ Confirmation email process completed");
}
