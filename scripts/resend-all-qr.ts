
import { getRegistrations } from "../src/utils/googleSheets";
import { generateQrCode, sendConfirmationEmail } from "../src/utils/ticket";

async function resendQRs() {
    console.log("Fetching all registrations from Google Sheets...");
    
    try {
        const registrations = await getRegistrations();
        if (!registrations || registrations.length === 0) {
            console.log("No registrations found.");
            return;
        }

        const verifiedRegistrants = registrations.filter(r => r.paymentStatus === "VERIFIED" && r.ticketId && r.email);
        console.log(`Found ${verifiedRegistrants.length} verified registrants with ticket IDs.`);

        if (verifiedRegistrants.length === 0) {
            console.log("No one to resend to. Exiting...");
            return;
        }

        let sentSuccessCount = 0;
        let sentFailCount = 0;

        for (const user of verifiedRegistrants) {
            console.log(`Processing ${user.name} (${user.email}) - Ticket: ${user.ticketId}`);
            try {
                const qrDataUrl = await generateQrCode(user.ticketId);
                const success = await sendConfirmationEmail(
                    user.email,
                    user.name,
                    user.workshop,
                    user.ticketId,
                    qrDataUrl
                );

                if (success) {
                    console.log(`[OK] Successfully sent to ${user.email}`);
                    sentSuccessCount++;
                } else {
                    console.error(`[ERROR] SMTP failed to send to ${user.email}`);
                    sentFailCount++;
                }
            } catch (err) {
                console.error(`[EXCEPTION] Error processing ${user.email}: `, err);
                sentFailCount++;
            }

            // Small delay to prevent SMTP rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n==========================================`);
        console.log(`RESEND COMPLETE`);
        console.log(`Successfully sent: ${sentSuccessCount}`);
        console.log(`Failed to send: ${sentFailCount}`);
        console.log(`==========================================\n`);

    } catch (error) {
        console.error("Critical error during execution:", error);
    }
}

resendQRs();
