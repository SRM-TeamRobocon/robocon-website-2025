import "server-only";

import { cookies } from "next/headers";
import * as jose from "jose";

export type SessionRole = "lead" | "admin" | "member";

export interface Session {
    role: SessionRole;
    user: string;
    name?: string;
    domain?: string;
    memberAccountId?: string;
    rosterId?: string | null;
}

export async function getSession(): Promise<Session | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return null;

    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback_secret_robocon_2026_!@#");
        const { payload } = await jose.jwtVerify(token, secret);
        if (!payload.role || !payload.user) return null;

        return {
            role: payload.role as SessionRole,
            user: payload.user as string,
            name: payload.name as string | undefined,
            domain: payload.domain as string | undefined,
            memberAccountId: payload.memberAccountId as string | undefined,
            rosterId: (payload.rosterId as string | null | undefined) ?? null,
        };
    } catch {
        return null;
    }
}

export function requireRole(session: Session | null, roles: SessionRole[]): session is Session {
    return session !== null && roles.includes(session.role);
}

export const ADMIN_COOKIE_NAME = "admin_token";

export interface SessionClaims {
    user: string;
    role: SessionRole;
    name?: string;
    domain?: string;
    memberAccountId?: string;
    rosterId?: string | null;
}

// Shared by /api/admin/login (password) and the member Google OAuth callback so both
// entry points mint identical tokens — keeping the signing logic in one place avoids
// the two paths drifting apart on claim shape or secret handling.
export async function signSession(claims: SessionClaims, expiresIn: string): Promise<string> {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback_secret_robocon_2026_!@#");
    return new jose.SignJWT({ ...claims })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
}

export function adminCookieOptions(maxAge: number) {
    return {
        name: ADMIN_COOKIE_NAME,
        httpOnly: true,
        secure: false, // matches the existing admin_token cookie — works over local HTTP
        sameSite: "lax" as const,
        path: "/",
        maxAge,
    };
}
