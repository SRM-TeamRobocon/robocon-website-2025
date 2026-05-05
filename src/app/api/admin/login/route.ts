import { NextResponse } from "next/server";
import { SignJWT } from "jose";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        // Hardcoded credentials as requested
        let userRole: "lead" | "desk" | null = null;

        try {
            const leads = JSON.parse(process.env.LEAD_ACCOUNTS || '{}');
            const desks = JSON.parse(process.env.DESK_ACCOUNTS || '{}');

            if (leads[username] === password) {
                userRole = "lead";
            } else if (desks[username] === password) {
                userRole = "desk";
            }
        } catch (e) {
            console.error("Failed to parse account dictionaries from .env", e);
            // Fallback for immediate testing
            if (username === "admin" && password === "admin") userRole = "lead";
        }

        if (userRole !== null) {
            // Sign JWT
            const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_robocon_2026_!@#');
            const token = await new SignJWT({ user: username, role: userRole })
                .setProtectedHeader({ alg: "HS256" })
                .setIssuedAt()
                .setExpirationTime("12h") // Session valid for 12 hours
                .sign(secret);

            const response = NextResponse.json({ success: true }, { status: 200 });

            // Set HttpOnly cookie
            response.cookies.set({
                name: "admin_token",
                value: token,
                httpOnly: true,
                secure: false, // Ensure this works over local HTTP
                sameSite: "lax",
                path: "/",
                maxAge: 60 * 60 * 12, // 12 hours
            });

            return response;
        }

        return NextResponse.json(
            { success: false, error: "Invalid username or password" },
            { status: 401 }
        );
    } catch (error) {
        console.error("Login API error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
