import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token")?.value;

        if (!token) {
            return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
        }

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_robocon_2026_!@#');
        const { payload } = await jose.jwtVerify(token, secret);

        return NextResponse.json({
            success: true,
            user: payload.user || "Admin",
            role: payload.role
        });
    } catch (error) {
        console.error("Error in /api/admin/me:", error);
        return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }
}
