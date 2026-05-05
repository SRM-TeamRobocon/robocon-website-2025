import Razorpay from "razorpay";
import { NextRequest, NextResponse } from "next/server";
import { sendConfirmationEmails } from "@/lib/send-emails";

export const dynamic = "force-dynamic";

function getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return null;

    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });
}

export async function POST(req: NextRequest) {
    try {
        const razorpay = getRazorpayClient();
        if (!razorpay) {
            return NextResponse.json(
                { error: "Payment gateway is not configured on server" },
                { status: 500 }
            );
        }

        const googleSheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
        if (!googleSheetUrl) {
            return NextResponse.json(
                { error: "Google Sheet webhook is not configured on server" },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { formData, paymentId, orderId } = body;

        // Validate required fields
        if (!formData || !paymentId || !orderId) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Double-check payment status with Razorpay API
        let payment;
        try {
            payment = await razorpay.payments.fetch(paymentId);
        } catch (fetchErr) {
            console.error("Failed to fetch payment from Razorpay:", fetchErr);
            return NextResponse.json(
                { error: "Could not verify payment with Razorpay" },
                { status: 502 }
            );
        }

        // Verify the payment is actually captured/authorized and matches the order
        if (payment.status !== "captured" && payment.status !== "authorized") {
            console.warn(
                `❌ Payment ${paymentId} has status "${payment.status}", not captured/authorized`
            );
            return NextResponse.json(
                { error: `Payment not completed. Status: ${payment.status}` },
                { status: 400 }
            );
        }

        if (payment.order_id !== orderId) {
            console.warn(
                `❌ Order ID mismatch: expected ${orderId}, got ${payment.order_id}`
            );
            return NextResponse.json(
                { error: "Order ID mismatch" },
                { status: 400 }
            );
        }

        // Submit to Google Sheets from the server (URLSearchParams for server-side compatibility)
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(formData)) {
            params.append(key, value as string);
        }
        params.append("PaymentID", paymentId);
        params.append("OrderID", orderId);
        params.append("TransactionID", "");
        params.append("PaymentStatus", "VERIFIED");

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
            `✅ Registration submitted — Payment: ${paymentId}, Order: ${orderId}`
        );

        // Send confirmation emails (await so Vercel doesn't kill the function early)
        await sendConfirmationEmails({ formData, paymentId, orderId }).catch((err) =>
            console.error("❌ Email sending failed:", err.message)
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Submit registration error:", error);
        return NextResponse.json(
            { error: "Failed to submit registration" },
            { status: 500 }
        );
    }
}
