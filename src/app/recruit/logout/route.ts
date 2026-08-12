import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { RECRUIT_COOKIE_NAME } from "@/lib/recruit-session";

export const dynamic = "force-dynamic";

// Direct-navigation logout (e.g. a plain link) — clears the cookie and redirects.
export async function GET(request: NextRequest) {
    const origin = new URL(request.url).origin;
    const response = NextResponse.redirect(`${origin}/recruit/login`);
    response.cookies.set({
        name: RECRUIT_COOKIE_NAME,
        value: "",
        path: "/",
        maxAge: 0,
    });
    return response;
}
