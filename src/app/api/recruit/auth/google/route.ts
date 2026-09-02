import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export const OAUTH_NONCE_COOKIE = "recruit_oauth_nonce";

// Kicks off the Google OAuth consent flow for recruit login/registration.
// Used for both login (existing google_uid) and registration (new user) - the
// callback route decides which path applies once it has the Google profile.
export async function GET(request: NextRequest) {
    const origin = new URL(request.url).origin;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        // Google OAuth credentials aren't filled in yet (see .env.local) - fail
        // loud with a redirect back to login rather than crashing.
        return NextResponse.redirect(`${origin}/recruit/login?error=google_not_configured`);
    }

    const redirectUri = `${origin}/api/recruit/auth/google/callback`;
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

    // CSRF / account-fixation defence: bind the callback to the browser that started
    // the flow. Without this, an attacker can complete the Google step themselves and
    // hand the victim a callback URL carrying the ATTACKER's code - the victim then
    // finishes registration with the attacker's google_uid stamped on their account,
    // letting the attacker log in as them via "Continue with Google".
    const nonce = randomBytes(16).toString("hex");

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "online",
        prompt: "select_account",
        state: nonce,
        scope: [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
    });

    const response = NextResponse.redirect(authUrl);
    response.cookies.set({
        name: OAUTH_NONCE_COOKIE,
        value: nonce,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        // `lax` (not `strict`) so the cookie is still sent when Google redirects the
        // browser back to us as a top-level cross-site navigation.
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 15,
    });
    return response;
}
