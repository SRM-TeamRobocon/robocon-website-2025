import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { timingSafeEqual } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { MEMBER_OAUTH_CONNECT_NONCE_COOKIE } from "@/lib/member-oauth";

export const dynamic = "force-dynamic";

type GoogleUserinfo = {
    id: string;
    email: string;
};

function nonceMatches(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// This route runs inside the popup opened by the dashboard "Connect Gmail" button, so
// on both success and failure it reports back to the opener via postMessage and closes
// itself rather than redirecting the popup to a full page.
function popupResponse(success: boolean, message: string, email?: string | null): NextResponse {
    const payload = JSON.stringify({ type: "member-google-connect", success, message, email: email ?? null });
    const html = `<!DOCTYPE html>
<html>
<body style="background:#0f0f0f;color:#e0e0e0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p>${escapeHtml(message)}</p>
  <script>
    if (window.opener) {
      window.opener.postMessage(${payload}, window.location.origin);
    }
    window.close();
  </script>
</body>
</html>`;
    const response = new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    response.cookies.set({ name: MEMBER_OAUTH_CONNECT_NONCE_COOKIE, value: "", path: "/", maxAge: 0 });
    return response;
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const origin = url.origin;
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
    const state = url.searchParams.get("state");

    const session = await getSession();
    if (!session || !session.memberAccountId) {
        return popupResponse(false, "You're no longer logged in - close this window and log in again.");
    }

    if (oauthError || !code) {
        return popupResponse(false, "Google sign-in was cancelled.");
    }

    const expectedNonce = request.cookies.get(MEMBER_OAUTH_CONNECT_NONCE_COOKIE)?.value;
    if (!state || !expectedNonce || !nonceMatches(state, expectedNonce)) {
        console.warn("member google connect state mismatch", { hasState: Boolean(state), hasNonceCookie: Boolean(expectedNonce) });
        return popupResponse(false, "Security check failed - please try again.");
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return popupResponse(false, "Google sign-in isn't configured yet.");
    }

    try {
        const redirectUri = `${origin}/api/member/auth/google/connect/callback`;
        const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

        const { tokens } = await oauth2Client.getToken(code);
        if (!tokens.access_token) {
            throw new Error("Google token exchange returned no access_token");
        }

        const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!userinfoRes.ok) {
            throw new Error(`Google userinfo fetch failed: ${userinfoRes.status}`);
        }
        const profile = (await userinfoRes.json()) as GoogleUserinfo;
        const googleUid = profile.id;
        const googleEmail = profile.email;

        const supabase = createSupabaseAdminClient();

        const { data: conflict } = await supabase
            .from("member_accounts")
            .select("id")
            .eq("google_uid", googleUid)
            .neq("id", session.memberAccountId)
            .maybeSingle();

        if (conflict) {
            return popupResponse(false, "This Google account is already connected to a different member account.");
        }

        const { error } = await supabase
            .from("member_accounts")
            .update({ google_uid: googleUid, google_email: googleEmail })
            .eq("id", session.memberAccountId);

        if (error) {
            return popupResponse(false, "Could not save the connection - please try again.");
        }

        return popupResponse(true, `Connected to ${googleEmail}.`, googleEmail);
    } catch (error) {
        console.error("member google connect callback error", error);
        return popupResponse(false, "Something went wrong connecting Google - please try again.");
    }
}
