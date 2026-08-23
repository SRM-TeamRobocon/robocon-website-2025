import QRCode from 'qrcode';
import { getTransporter, SMTP_EMAIL } from '@/lib/mailer';

export async function generateTicketId(name: string, phone: string): Promise<string> {
    const prefix = "ROBO";
    const namePart = name.substring(0, 2).toUpperCase();
    const phonePart = phone.substring(phone.length - 4);
    const randomPart = Math.floor(100 + Math.random() * 900); // 3 random digits

    return `${prefix}-${namePart}${phonePart}-${randomPart}`;
}

export async function generateQrCode(ticketId: string): Promise<string> {
    try {
        // We embed the ticket ID in the QR code. The scanner will read this.
        const qrDataUrl = await QRCode.toDataURL(ticketId, {
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        return qrDataUrl;
    } catch (err) {
        console.error("Error generating QR code:", err);
        throw err;
    }
}

export async function sendConfirmationEmail(
    toEmail: string,
    name: string,
    workshopName: string,
    ticketId: string,
    qrDataUrl: string
) {
    const transporter = getTransporter();
    if (!transporter || !SMTP_EMAIL) {
        console.warn("SMTP credentials missing. Email not sent, but process continues.");
        return false;
    }

    try {
        const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; color: #333; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #1a1a2e; color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; color: #e11d48; font-size: 28px;">SRM Team Robocon</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Workshop Registration Confirmed</p>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2 style="margin-top: 0; color: #1a1a2e;">Hello ${name},</h2>
          <p style="line-height: 1.6;">Your payment has been successfully verified! You are officially registered for the <strong>${workshopName} Workshop</strong>.</p>
          
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <p style="font-size: 14px; color: #64748b; margin-top: 0; text-transform: uppercase; letter-spacing: 1px;">Official Ticket ID</p>
            <h3 style="font-size: 24px; color: #1e293b; margin: 10px 0; font-family: monospace;">${ticketId}</h3>
            
            <p style="font-size: 14px; margin-bottom: 5px;">Please present this QR code at the registration desk.</p>
            <img src="${qrDataUrl}" alt="Ticket QR Code" style="display: block; margin: 0 auto; max-width: 250px; height: auto;" />
          </div>
          
          <h3 style="color: #1a1a2e; border-bottom: 2px solid #e11d48; padding-bottom: 8px; display: inline-block;">Event Details</h3>
          <ul style="list-style-type: none; padding: 0; line-height: 1.8;">
            <li><strong>Event:</strong> ${workshopName} Workshop</li>
            <li><strong>Dates:</strong> 11th, 12th & 13th March</li>
            <li><strong>Time:</strong> 9:00 AM to 3:00 PM</li>
            <li><strong>Requirement:</strong> Please bring your laptop.</li>
          </ul>
          
          <p style="margin-top: 30px; font-size: 14px; color: #64748b;">If you have any questions, please contact us on Instagram @srmteamrobocon.</p>
        </div>
        
        <div style="background-color: #f1f5f9; padding: 15px 20px; text-align: center; font-size: 12px; color: #94a3b8;">
          &copy; 2026 SRM Team Robocon. All rights reserved.
        </div>
      </div>
    `;

        await transporter.sendMail({
            from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
            to: toEmail,
            subject: `Your Ticket: ${workshopName} Workshop`,
            html: htmlContent,
            attachments: [
                {
                    filename: 'ticket-qr.png',
                    content: qrDataUrl.split("base64,")[1],
                    encoding: 'base64',
                    cid: 'qrcode' // same cid value as in the html img src if we wanted to embed via cid
                }
            ]
        });

        console.log(`Confirmation email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error("Error sending confirmation email:", error);
        return false;
    }
}
