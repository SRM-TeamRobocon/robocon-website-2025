import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const COOKIE = "academia_access_token_";
const COOKIE_PATH = "/api/member/academia";
const API_URL = process.env.ACADEMIA_API_URL || "https://edutechsrm-backend.goelaarav777.workers.dev";
const ROLES = ["member", "lead", "admin"] as const;

function clearAccessCookie(response: NextResponse, memberAccountId: string) {
    response.cookies.set(COOKIE + memberAccountId, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: COOKIE_PATH, maxAge: 0 });
    return response;
}

function setAccessCookie(response: NextResponse, memberAccountId: string, token: string) {
    response.cookies.set(COOKIE + memberAccountId, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: COOKIE_PATH,
    });
    return response;
}

function cleanAcademicData(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(cleanAcademicData);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([key]) => !/password|token|secret|credential/i.test(key) && !/^_?username$/i.test(key))
            .map(([key, item]) => [key, cleanAcademicData(item)])
    );
}

async function getMemberAccountId() {
    const session = await getSession();
    return requireRole(session, [...ROLES]) ? session.memberAccountId || null : null;
}

async function loginUpstream(username: string, password: string) {
    const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const result = await response.json().catch(() => null);
    return typeof result?.token === "string" && result.token.length <= 4096 ? result.token : null;
}

async function loadHydrate(token: string) {
    return fetch(`${API_URL}/api/hydrate`, {
        headers: { "x-access-token": token },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
    });
}

export async function POST(request: Request) {
    const memberAccountId = await getMemberAccountId();
    if (!memberAccountId) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: "Enter your SRM username and password." }, { status: 400 });
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || username.length > 100 || !password || password.length > 256) {
        return NextResponse.json({ success: false, error: "Enter your SRM username and password." }, { status: 400 });
    }

    try {
        const token = await loginUpstream(username, password);
        if (!token) return NextResponse.json({ success: false, error: "SRM Academia login failed. Check your credentials and try again." }, { status: 401 });

        return setAccessCookie(NextResponse.json({ success: true }), memberAccountId, token);
    } catch {
        return NextResponse.json({ success: false, error: "Could not connect to SRM Academia." }, { status: 502 });
    }
}

export async function GET() {
    const memberAccountId = await getMemberAccountId();
    if (!memberAccountId) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const token = (await cookies()).get(COOKIE + memberAccountId)?.value;
    if (!token) return NextResponse.json({ success: false, connected: false }, { status: 401 });

    try {
        const upstream = await loadHydrate(token);
        if (upstream.status === 401 || upstream.status === 403) {
            return clearAccessCookie(NextResponse.json({ success: false, connected: false, error: "Academia session expired. Sign in again." }, { status: 401 }), memberAccountId);
        }

        if (!upstream.ok) return NextResponse.json({ success: false, connected: true, error: "Could not load academic data." }, { status: 502 });
        const data = await upstream.json().catch(() => null);
        return NextResponse.json({ success: true, connected: true, data: cleanAcademicData(data) });
    } catch {
        return NextResponse.json({ success: false, connected: true, error: "Could not connect to SRM Academia." }, { status: 502 });
    }
}

export async function DELETE() {
    const memberAccountId = await getMemberAccountId();
    if (!memberAccountId) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    return clearAccessCookie(NextResponse.json({ success: true }), memberAccountId);
}
