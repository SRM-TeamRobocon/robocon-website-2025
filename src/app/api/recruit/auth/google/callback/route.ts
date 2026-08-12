import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { timingSafeEqual } from "crypto";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import {
    issueRecruitToken,
    signOAuthState,
    OAUTH_STATE_COOKIE,
    OAUTH_STATE_COOKIE_OPTIONS,
    RECRUIT_COOKIE_NAME,
    RECRUIT_COOKIE_OPTIONS,
} from "@/lib/recruit-session";
import { OAUTH_NONCE_COOKIE } from "../route";

export const dynamic = "force-dynamic";

type GoogleUserinfo = {
    id: string;
    email: string;
    name?: string;
    picture?: string;
};

function nonceMatches(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const origin = url.origin;
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
    const state = url.searchParams.get("state");

    if (oauthError || !code) {
        return NextResponse.redirect(`${origin}/recruit/login?error=google_auth_failed`);
    }

    // Reject any callback that didn't originate from a flow this browser started.
    const expectedNonce = request.cookies.get(OAUTH_NONCE_COOKIE)?.value;
    if (!state || !expectedNonce || !nonceMatches(state, expectedNonce)) {
        console.warn("recruit google oauth state mismatch", {
            hasState: Boolean(state),
            hasNonceCookie: Boolean(expectedNonce),
        });
        return NextResponse.redirect(`${origin}/recruit/login?error=google_state_mismatch`);
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return NextResponse.redirect(`${origin}/recruit/login?error=google_not_configured`);
    }

    try {
        const redirectUri = `${origin}/api/recruit/auth/google/callback`;
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
        const personalEmail = profile.email;
        const name = profile.name || "";

        const supabase = createRecruitSupabaseAdminClient();

        const { data: cycle } = await supabase
            .from("recruitment_cycles")
            .select("id")
            .eq("is_active", true)
            .maybeSingle();

        if (!cycle) {
            return NextResponse.redirect(`${origin}/recruit/login?error=no_active_cycle`);
        }

        const { data: existing } = await supabase
            .from("recruit_accounts")
            .select("id, srm_email, srm_email_verified")
            .eq("google_uid", googleUid)
            .eq("cycle_id", cycle.id)
            .maybeSingle();

        if (existing && existing.srm_email_verified) {
            // Existing, fully-registered recruit — Google OAuth doubles as login.
            const token = await issueRecruitToken({
                recruit_id: existing.id,
                srm_email: existing.srm_email,
                cycle_id: cycle.id,
            });

            const response = NextResponse.redirect(`${origin}/recruit/dashboard`);
            response.cookies.set({ name: RECRUIT_COOKIE_NAME, value: token, ...RECRUIT_COOKIE_OPTIONS });
            response.cookies.set({ name: OAUTH_NONCE_COOKIE, value: "", path: "/", maxAge: 0 });
            return response;
        }

        // No account yet, or an account that never finished SRM email verification —
        // stash the Google profile in a short-lived signed cookie and continue registration.
        const stateToken = await signOAuthState({
            google_uid: googleUid,
            personal_email: personalEmail,
            name,
            nonce: expectedNonce,
        });

        const response = NextResponse.redirect(
            `${origin}/recruit/register?name=${encodeURIComponent(name)}&email=${encodeURIComponent(personalEmail)}`
        );
        response.cookies.set({ name: OAUTH_STATE_COOKIE, value: stateToken, ...OAUTH_STATE_COOKIE_OPTIONS });
        response.cookies.set({ name: OAUTH_NONCE_COOKIE, value: "", path: "/", maxAge: 0 });
        return response;
    } catch (error) {
        console.error("recruit google oauth callback error", error);
        return NextResponse.redirect(`${origin}/recruit/login?error=google_auth_failed`);
    }
}
