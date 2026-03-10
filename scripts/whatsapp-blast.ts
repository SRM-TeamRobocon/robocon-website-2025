import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
// @ts-ignore
import qrcode from 'qrcode-terminal';
import { generateQrCode } from "../src/utils/ticket";
import { getRegistrations } from "../src/utils/googleSheets";

// The script takes an argument from command line
const runMode = process.argv[2] && process.argv[2].toUpperCase() === 'ALL' ? 'ALL' : 'TEST';

const getAltiumCaption = (ticketId: string) => `🎟 *SRM Team Robocon – Altium PCB Workshop Ticket* 🤖

✅ *Thank you for registering!*

*🎫 Ticket Details*
Ticket ID: *${ticketId}*
Please present your *QR Code at the registration desk* during entry.

*📅 Event Details*
*Altium PCB Design Workshop* hosted by *SRM Team Robocon*

🗓 *Date:* 11th – 13th March 2026
⏰ *Time:* 9:00 AM – 3:00 PM

📍 *Venue:* Automobile Seminar Hall

🎁 *Perks:*
• Certificate of Participation
• OD for the workshop duration
• Hands-on PCB design learning
• Refreshments provided

📸 *Don’t forget to follow us on Instagram:*
https://www.instagram.com/srmteamrobocon

🌐 https://www.srmteamrobocon.com`;

const getSolidworksCaption = (ticketId: string) => `🎟 *SRM Team Robocon – Solidworks CAD Workshop Ticket* 🤖

✅ *Thank you for registering!*

*🎫 Ticket Details*
Ticket ID: *${ticketId}*
Please present your *QR Code at the registration desk* during entry.

*📅 Event Details*
*Solidworks CAD Modeling Workshop* hosted by *SRM Team Robocon*

🗓 *Date:* 11th – 13th March 2026
⏰ *Time:* 9:00 AM – 3:00 PM

📍 *Venue:* Hi-Tech 513

🎁 *Perks:*
• Certificate of Participation
• OD for the workshop duration
• Hands-on 3D CAD modeling learning
• Refreshments provided

📸 *Don’t forget to follow us on Instagram:*
https://www.instagram.com/srmteamrobocon

🌐 https://www.srmteamrobocon.com`;

function formatPhoneNumber(whatsappNumber: string) {
    let clean = whatsappNumber.replace(/\D/g, ''); // leave only digits
    if (clean.length === 10) {
        clean = "91" + clean;
    }
    return clean;
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log("=============================================================");
    console.log("PLEASE SCAN THE QR CODE ON YOUR PHONE WHATSAPP LINKED DEVICES");
    console.log("=============================================================");
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('\n✅ WhatsApp Web Client is ready!');
    console.log(`Running in ${runMode} mode...`);

    try {
        const registrations = await getRegistrations();
        if (!registrations || registrations.length === 0) {
            console.log("No registrations found.");
            process.exit(1);
        }

        let verifiedRegistrants = registrations.filter(r => r.paymentStatus === "VERIFIED" && r.ticketId && r.whatsapp);

        if (runMode === "TEST") {
            verifiedRegistrants = verifiedRegistrants.filter(r => r.name.toLowerCase() === "test");
        }

        console.log(`Found ${verifiedRegistrants.length} registrants to message.`);

        if (verifiedRegistrants.length === 0) {
            console.log("No users matched the criteria. Exiting...");
            setTimeout(() => { process.exit(0); }, 3000);
            return;
        }

        let sentSuccessCount = 0;
        let sentFailCount = 0;

        for (const user of verifiedRegistrants) {
            console.log(`\n---------------------------------`);
            console.log(`Processing: ${user.name} | Workshop: ${user.workshop} | WP: ${user.whatsapp}`);
            const formattedPhone = formatPhoneNumber(user.whatsapp);
            const chatId = formattedPhone + "@c.us";

            try {
                const isRegistered = await client.isRegisteredUser(chatId);
                if (!isRegistered) {
                    console.error(`❌ Number ${formattedPhone} is NOT registered on WhatsApp! Skipping...`);
                    sentFailCount++;
                    continue; // skip to next user
                }

                console.log(`Generating QR for ticket: ${user.ticketId}...`);
                const qrDataUrl = await generateQrCode(user.ticketId);
                const [, base64Data] = qrDataUrl.split(',');

                let mediaName = "ticket-qr.png";
                let caption = "";

                if (user.workshop.toLowerCase() === "altium") {
                    mediaName = "altium-qr.png";
                    caption = getAltiumCaption(user.ticketId);
                } else {
                    mediaName = "solidworks-qr.png";
                    caption = getSolidworksCaption(user.ticketId);
                }

                const media = new MessageMedia('image/png', base64Data, mediaName);

                console.log(`Sending WhatsApp message...`);
                await client.sendMessage(chatId, media, { caption: caption });
                console.log(`✅ Message sent to ${user.name} (${formattedPhone})`);
                sentSuccessCount++;
            } catch (err) {
                console.error(`❌ Failed processing ${user.name}:`, err);
                sentFailCount++;
            }

            // Small delay to prevent WhatsApp ban / rate limiting
            await new Promise(r => setTimeout(r, 4000));
        }

        console.log(`\n==========================================`);
        console.log(`WHATSAPP BATCH COMPLETE [${runMode} MODE]`);
        console.log(`Successfully sent: ${sentSuccessCount}`);
        console.log(`Failed to send: ${sentFailCount}`);
        console.log(`==========================================\n`);

    } catch (err) {
        console.error("Critical error during Whatsapp blast:", err);
    } finally {
        setTimeout(() => {
            console.log("Shutting down WhatsApp Web Client session...");
            client.destroy();
            process.exit(0);
        }, 15000); // give 15 seconds to ensure final messages hit the WA server queue
    }
});

// Catch auth issues
client.on('auth_failure', msg => {
    console.error('❌ Authentication failed:', msg);
});

console.log("Initializing WhatsApp Bot. This might take a few seconds as puppeteer spins up...");
client.initialize();
