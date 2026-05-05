import { generateTicketId, generateQrCode, sendConfirmationEmail } from "../src/utils/ticket";

async function run() {
    console.log("Generating ticket...");
    const ticketId = await generateTicketId("Daksh Kothari", "9876543210");
    const qrData = await generateQrCode(ticketId);

    console.log("Sending email to dakshkothari77@gmail.com...");
    const success = await sendConfirmationEmail(
        "dakshkothari77@gmail.com",
        "Daksh Kothari",
        "Solidworks",
        ticketId,
        qrData
    );

    if (success) {
        console.log("Email sent successfully!");
    } else {
        console.log("Failed to send email. Check SMTP credentials.");
    }
}

run().catch(console.error);
