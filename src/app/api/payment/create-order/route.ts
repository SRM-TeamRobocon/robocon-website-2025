import Razorpay from "razorpay";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        return null;
    }

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

        const body = await req.json();
        const { amount, workshop, name, email } = body;

        // Validate required fields
        if (!amount || !workshop || !name || !email) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Validate amount matches expected price (₹599 = 59900 paise)
        if (amount !== 59900) {
            return NextResponse.json(
                { error: "Invalid amount" },
                { status: 400 }
            );
        }

        const order = await razorpay.orders.create({
            amount: amount, // amount in paise
            currency: "INR",
            receipt: `workshop_${Date.now()}`,
            notes: {
                workshop,
                name,
                email,
            },
        });

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        });
    } catch (error: any) {
        console.error("Razorpay order creation failed:", error);
        return NextResponse.json(
            { error: "Failed to create payment order" },
            { status: 500 }
        );
    }
}
