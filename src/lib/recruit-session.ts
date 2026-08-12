import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export type RecruitSession = {
  recruit_id: string;
  srm_email: string;
  cycle_id: string;
};

// Fail closed in production rather than silently signing recruit tokens with a
// value that is committed to this repository — anyone could then mint a token for
// any recruit. In development a fallback keeps local setup frictionless, but it
// warns loudly so it can't be mistaken for a working configuration.
export function recruitJwtSecret(): Uint8Array {
  const configured = process.env.RECRUIT_JWT_SECRET;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RECRUIT_JWT_SECRET is not set — refusing to issue or verify recruit tokens.");
    }
    console.warn("[recruit-auth] RECRUIT_JWT_SECRET is unset — using an insecure development fallback.");
    return new TextEncoder().encode("fallback_recruit_secret_!@#");
  }
  return new TextEncoder().encode(configured);
}

const secret = recruitJwtSecret;

// --- OAuth state cookie (shared by the Google callback, verify-otp and
// complete-registration so the `purpose` claim is enforced in exactly one place) ---

export const OAUTH_STATE_COOKIE = "recruit_oauth_state";
const OAUTH_STATE_TTL = "15m";

// `lax` (not `strict`) because this cookie is also set on the Google OAuth callback's
// redirect response — a hop inside a navigation that *started* as a cross-site redirect
// from accounts.google.com. Browsers evaluate SameSite over the whole redirect chain, so
// a `strict` cookie set mid-chain can be silently dropped on the very next same-origin
// hop even though it's genuinely first-party by then. Same reasoning as
// OAUTH_NONCE_COOKIE in src/app/api/recruit/auth/google/route.ts.
export const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 15,
};

export type OAuthStatePayload = {
  purpose: "oauth_state";
  google_uid?: string;
  personal_email?: string;
  name?: string;
  srm_email?: string;
  srm_verified?: boolean;
  // Random nonce echoed through Google's `state` param to bind the callback to the
  // browser that actually started the flow (prevents login-CSRF / account fixation).
  nonce?: string;
};

export async function signOAuthState(payload: Omit<OAuthStatePayload, "purpose">): Promise<string> {
  return new SignJWT({ ...payload, purpose: "oauth_state" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(OAUTH_STATE_TTL)
    .sign(secret());
}

export async function verifyOAuthState(token: string | undefined): Promise<OAuthStatePayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== "oauth_state") return null;
    return payload as OAuthStatePayload;
  } catch {
    return null;
  }
}

export async function getRecruitSession(): Promise<RecruitSession | null> {
  const token = (await cookies()).get("recruit_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.recruit_id || !payload.srm_email || !payload.cycle_id) return null;
    return {
      recruit_id: payload.recruit_id as string,
      srm_email: payload.srm_email as string,
      cycle_id: payload.cycle_id as string,
    };
  } catch {
    return null;
  }
}

export async function requireRecruitAuth(): Promise<RecruitSession> {
  const session = await getRecruitSession();
  if (!session) throw new Error("Not authenticated as recruit");
  return session;
}

export async function issueRecruitToken(payload: RecruitSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export const RECRUIT_COOKIE_NAME = "recruit_token";

// `lax` for the same reason as OAUTH_STATE_COOKIE_OPTIONS above — this is also set on
// the Google OAuth callback's redirect response (the login-via-Google path), where
// `strict` risks being dropped mid-redirect-chain.
export const RECRUIT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};
