import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { timingSafeEqual } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminCookieOptions, signSession } from "@/lib/session";
import {
    MEMBER_GOOGLE_PENDING_COOKIE,
    MEMBER_OAUTH_NONCE_COOKIE,
    PENDING_GOOGLE_COOKIE_OPTIONS,
    signPendingGoogleProfile,
} from "@/lib/member-oauth";

export const dynamic = "force-dynamic";

type GoogleUserinfo = {
    id: string;
    email: string;
    name?: string;
};

function nonceMatches(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function clearNonceCookie(response: NextResponse) {
    response.cookies.set({ name: MEMBER_OAUTH_NONCE_COOKIE, value: "", path: "/", maxAge: 0 });
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const origin = url.origin;
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
    const state = url.searchParams.get("state");

    if (oauthError || !code) {
        const response = NextResponse.redirect(`${origin}/login?role=member&error=google_auth_failed`);
        clearNonceCookie(response);
        return response;
    }

    const expectedNonce = request.cookies.get(MEMBER_OAUTH_NONCE_COOKIE)?.value;
    if (!state || !expectedNonce || !nonceMatches(state, expectedNonce)) {
        console.warn("member google oauth state mismatch", { hasState: Boolean(state), hasNonceCookie: Boolean(expectedNonce) });
        const response = NextResponse.redirect(`${origin}/login?role=member&error=google_state_mismatch`);
        clearNonceCookie(response);
        return response;
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        const response = NextResponse.redirect(`${origin}/login?role=member&error=google_not_configured`);
        clearNonceCookie(response);
        return response;
    }

    try {
        const redirectUri = `${origin}/api/member/auth/google/callback`;
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
        const { data: account } = await supabase
            .from("member_accounts")
            .select("id, name, email, domain, email_verified, is_approved, role")
            .eq("google_uid", googleUid)
            .maybeSingle();

        if (!account) {
            // Not connected yet - stash the profile and send them to log in with a
            // password once, which will link it (see /api/admin/login).
            const pendingToken = await signPendingGoogleProfile({ google_uid: googleUid, google_email: googleEmail });
            const response = NextResponse.redirect(`${origin}/login?role=member&notice=connect_google`);
            response.cookies.set({ name: MEMBER_GOOGLE_PENDING_COOKIE, value: pendingToken, ...PENDING_GOOGLE_COOKIE_OPTIONS });
            clearNonceCookie(response);
            return response;
        }

        if (!account.email_verified) {
            const response = NextResponse.redirect(`${origin}/login?role=member&error=google_not_verified`);
            clearNonceCookie(response);
            return response;
        }
        if (!account.is_approved) {
            const response = NextResponse.redirect(`${origin}/login?role=member&error=google_not_approved`);
            clearNonceCookie(response);
            return response;
        }

        const { data: roster } = await supabase
            .from("members")
            .select("id")
            .eq("member_account_id", account.id)
            .maybeSingle();

        const accountRole = (account.role as "lead" | "admin" | "member") || "member";
        const expiresIn = accountRole === "member" ? "7d" : "12h";
        const maxAge = accountRole === "member" ? 60 * 60 * 24 * 7 : 60 * 60 * 12;

        const token = await signSession(
            {
                user: account.email,
                role: accountRole,
                name: account.name,
                domain: account.domain,
                memberAccountId: account.id,
                rosterId: roster?.id ?? null,
            },
            expiresIn
        );

        const response = NextResponse.redirect(`${origin}/dashboard`);
        response.cookies.set({ ...adminCookieOptions(maxAge), value: token });
        clearNonceCookie(response);
        return response;
    } catch (error) {
        console.error("member google oauth callback error", error);
        const response = NextResponse.redirect(`${origin}/login?role=member&error=google_auth_failed`);
        clearNonceCookie(response);
        return response;
    }
}
