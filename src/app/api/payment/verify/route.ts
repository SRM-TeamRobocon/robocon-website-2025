import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            return NextResponse.json(
                { verified: false, error: "Payment verification is not configured on server" },
                { status: 500 }
            );
        }

        const body = await req.json();
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = body;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json(
                { verified: false, error: "Missing payment verification fields" },
                { status: 400 }
            );
        }

        // Generate expected signature using HMAC SHA256
        // Razorpay signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
        const generatedSignature = crypto
            .createHmac("sha256", secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const generatedBuffer = Buffer.from(generatedSignature, "hex");
        const signatureBuffer = Buffer.from(razorpay_signature, "hex");

        // Constant-time comparison to prevent timing attacks, only if lengths match
        let isValid = false;
        if (generatedBuffer.length === signatureBuffer.length) {
            isValid = crypto.timingSafeEqual(generatedBuffer, signatureBuffer);
        }

        if (isValid) {
            console.log(
                `✅ Payment verified — Order: ${razorpay_order_id}, Payment: ${razorpay_payment_id}`
            );
            return NextResponse.json({
                verified: true,
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
            });
        } else {
            console.warn(
                `❌ Payment verification FAILED — Order: ${razorpay_order_id}`
            );
            return NextResponse.json(
                { verified: false, error: "Payment signature verification failed" },
                { status: 400 }
            );
        }
    } catch (error: any) {
        console.error("Payment verification error:", error);
        return NextResponse.json(
            { verified: false, error: "Verification failed" },
            { status: 500 }
        );
    }
}
