import { NextResponse } from "next/server";
import { RECRUIT_COOKIE_NAME } from "@/lib/recruit-session";

export const dynamic = "force-dynamic";

// Called via fetch() from client components — clears the cookie and hands back
// a redirect target rather than issuing an HTTP redirect itself (a redirected
// fetch() response isn't useful to a client that expects JSON). Direct-navigation
// logout (e.g. a plain <a href="/recruit/logout"> link) is handled by the separate
// GET route at src/app/recruit/logout/route.ts, which does redirect.
export async function POST() {
    const response = NextResponse.json({ success: true, redirect: "/recruit/login" });
    response.cookies.set({
        name: RECRUIT_COOKIE_NAME,
        value: "",
        path: "/",
        maxAge: 0,
    });
    return response;
}
