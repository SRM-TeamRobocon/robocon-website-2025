import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set({
        name: "admin_token",
        value: "",
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
    return response;
}
