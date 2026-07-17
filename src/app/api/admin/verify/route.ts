import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import { updatePaymentStatus, updateTicketId } from "@/utils/googleSheets";
import { generateTicketId, generateQrCode, sendConfirmationEmail } from "@/utils/ticket";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        // Enforce Lead Role
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token")?.value;
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_robocon_2026_!@#');

        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { payload } = await jose.jwtVerify(token, secret);
        if (payload.role !== "lead" && payload.role !== "admin") {
            return NextResponse.json({ success: false, error: "Lead account required for verification" }, { status: 403 });
        }

        const body = await request.json();
        const { rowIndex, name, phone, email, workshop } = body;

        if (!rowIndex || !name || !phone || !email || !workshop) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        // 1. Update Google Sheet Status to VERIFIED
        const updated = await updatePaymentStatus(rowIndex, "VERIFIED");

        if (!updated) {
            return NextResponse.json(
                { success: false, error: "Failed to update Google Sheets" },
                { status: 500 }
            );
        }

        // 2. Generate Ticket and QR code
        const ticketId = await generateTicketId(name, phone);
        const qrDataUrl = await generateQrCode(ticketId);

        // 2b. Write Ticket ID to Google Sheets
        await updateTicketId(rowIndex, ticketId);

        // 3. Send the Confirmation Email
        const emailSent = await sendConfirmationEmail(
            email,
            name,
            workshop,
            ticketId,
            qrDataUrl
        );

        if (!emailSent) {
            console.warn("Status updated, but failed to send email.");
            return NextResponse.json(
                { success: true, warning: "Verified, but email failed to send" },
                { status: 200 }
            );
        }

        return NextResponse.json({ success: true, ticketId }, { status: 200 });
    } catch (error) {
        console.error("Error in verification API:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
