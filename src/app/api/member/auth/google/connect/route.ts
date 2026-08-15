import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/session";
import { MEMBER_OAUTH_CONNECT_NONCE_COOKIE, NONCE_COOKIE_OPTIONS } from "@/lib/member-oauth";

export const dynamic = "force-dynamic";

// Opened in a popup from the dashboard "Connect Gmail" button. Requires an active
// member session — the callback links the Google profile to session.memberAccountId,
// so there's no need to carry account identity through the OAuth `state` param.
export async function GET(request: NextRequest) {
    const origin = new URL(request.url).origin;

    const session = await getSession();
    if (!session || !session.memberAccountId) {
        return NextResponse.redirect(`${origin}/login`);
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return NextResponse.redirect(`${origin}/dashboard/profile?google_error=not_configured`);
    }

    const redirectUri = `${origin}/api/member/auth/google/connect/callback`;
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

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
    response.cookies.set({ name: MEMBER_OAUTH_CONNECT_NONCE_COOKIE, value: nonce, ...NONCE_COOKIE_OPTIONS });
    return response;
}
