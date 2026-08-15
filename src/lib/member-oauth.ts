import "server-only";

import { jwtVerify, SignJWT } from "jose";

function secret(): Uint8Array {
    return new TextEncoder().encode(process.env.JWT_SECRET || "fallback_secret_robocon_2026_!@#");
}

// CSRF nonce for the "sign in with Google" (login) flow, started at /api/member/auth/google.
export const MEMBER_OAUTH_NONCE_COOKIE = "member_oauth_nonce";
// Separate nonce for the "connect Gmail" (link-to-existing-session) flow, started at
// /api/member/auth/google/connect — kept distinct so a login attempt and a connect
// attempt in different tabs can't cross-contaminate each other's state.
export const MEMBER_OAUTH_CONNECT_NONCE_COOKIE = "member_oauth_connect_nonce";

export const NONCE_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` (not `strict`) because this cookie must survive the cross-site redirect
    // chain back from accounts.google.com — same reasoning as the recruit OAuth flow.
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 15,
};

// Stashes a Google profile that didn't match any member_accounts row yet, so that the
// very next successful username/password login can link it automatically instead of
// making the member repeat the Google step from inside the dashboard.
export const MEMBER_GOOGLE_PENDING_COOKIE = "member_google_pending";

export const PENDING_GOOGLE_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
};

export type PendingGoogleProfile = {
    purpose: "member_google_pending";
    google_uid: string;
    google_email: string;
};

export async function signPendingGoogleProfile(payload: Omit<PendingGoogleProfile, "purpose">): Promise<string> {
    return new SignJWT({ ...payload, purpose: "member_google_pending" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("10m")
        .sign(secret());
}

export async function verifyPendingGoogleProfile(token: string | undefined): Promise<PendingGoogleProfile | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secret());
        if (payload.purpose !== "member_google_pending" || !payload.google_uid) return null;
        return payload as unknown as PendingGoogleProfile;
    } catch {
        return null;
    }
}
