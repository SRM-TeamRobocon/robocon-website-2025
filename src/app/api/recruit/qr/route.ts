import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getRecruitSession } from "@/lib/recruit-session";
import { signQR } from "@/lib/recruit-qr";

export const dynamic = "force-dynamic";

// GET /api/recruit/qr
// Requires recruit_token (also enforced by src/proxy.ts, checked again here defensively).
// Returns a PNG data URL of the recruit's HMAC-signed, mode-agnostic QR payload.
export async function GET() {
    const session = await getRecruitSession();
    if (!session) {
        return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    try {
        const payload = signQR(session.recruit_id, session.cycle_id);
        const qr_data_url = await QRCode.toDataURL(payload, { width: 300, margin: 2 });

        return NextResponse.json({ success: true, qr_data_url, payload });
    } catch (error) {
        console.error("Error generating recruit QR:", error);
        return NextResponse.json({ success: false, error: "Failed to generate QR code" }, { status: 500 });
    }
}
