import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const googleSheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
        if (!googleSheetUrl) {
            return NextResponse.json(
                { error: "Google Sheet webhook is not configured on server" },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { formData, transactionId } = body;

        // Validate required fields
        if (!formData || !transactionId) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Validate TransactionID format (12-digit UTR)
        if (!/^\d{12}$/.test(transactionId.trim())) {
            return NextResponse.json(
                { error: "Transaction ID must be exactly 12 digits" },
                { status: 400 }
            );
        }

        // Submit to Google Sheets from the server (URLSearchParams for server-side compatibility)
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(formData)) {
            params.append(key, value as string);
        }
        params.append("PaymentID", "");
        params.append("OrderID", "");
        params.append("TransactionID", transactionId.trim());
        params.append("PaymentStatus", "PENDING");

        const sheetRes = await fetch(googleSheetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
            redirect: "follow",
        });

        const sheetText = await sheetRes.text();
        let sheetData: any = {};
        try { sheetData = JSON.parse(sheetText); } catch { }

        if (!sheetRes.ok && !sheetData.result) {
            console.error("Google Sheets submission failed:", sheetRes.status);
            return NextResponse.json(
                { error: "Registration submission failed" },
                { status: 502 }
            );
        }

        // Check for duplicate registration
        if (sheetData.result === "duplicate") {
            return NextResponse.json(
                { error: "This registration number is already registered for the workshop." },
                { status: 409 }
            );
        }

        console.log(
            `⏳ Manual UPI registration submitted — UTR: ${transactionId}, Name: ${formData.Name}`
        );

        // Tickets aren't sent immediately for manual registrations — a lead/admin must
        // verify the payment first via the dashboard (`/api/admin/verify`), which triggers
        // the official ticket email.

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Submit manual registration error:", error);
        return NextResponse.json(
            { error: "Failed to submit registration" },
            { status: 500 }
        );
    }
}
