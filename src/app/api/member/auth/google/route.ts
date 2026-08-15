import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "crypto";
import { MEMBER_OAUTH_NONCE_COOKIE, NONCE_COOKIE_OPTIONS } from "@/lib/member-oauth";

export const dynamic = "force-dynamic";

// Kicks off the Google OAuth consent flow for member login. The callback decides
// whether the resulting Google profile matches an existing member_accounts row
// (log in) or not (stash it and ask for a password login to connect it).
export async function GET(request: NextRequest) {
    const origin = new URL(request.url).origin;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(`${origin}/login?role=member&error=google_not_configured`);
    }

    const redirectUri = `${origin}/api/member/auth/google/callback`;
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

    // CSRF / account-fixation defence, same reasoning as the recruit Google flow: bind
    // the callback to the browser that started it via a random nonce echoed through state.
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
    response.cookies.set({ name: MEMBER_OAUTH_NONCE_COOKIE, value: nonce, ...NONCE_COOKIE_OPTIONS });
    return response;
}
