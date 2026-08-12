import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/scanner') || pathname.startsWith('/recruit-scanner');
    // /api/admin/login is carved out of the admin_token cookie gate since it's the entry
    // point that issues that cookie.
    const isProtectedApi =
        pathname.startsWith('/api/admin') &&
        pathname !== '/api/admin/login';

    // Protect /dashboard, /scanner, /recruit-scanner (UI) and /api/admin (backend) routes — everything else is public
    if (isProtectedPage || isProtectedApi) {
        const token = request.cookies.get('admin_token')?.value;

        if (!token) {
            // Return 401 JSON for API routes
            if (isProtectedApi) {
                return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
            }

            // Return Redirect for UI routes
            return NextResponse.redirect(new URL('/login', request.url));
        }

        try {
            // Very basic JWT verification using jose (edge runtime compatible)
            const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_robocon_2026_!@#');
            await jose.jwtVerify(token, secret);
            return NextResponse.next();
        } catch {
            // Invalid token
            // Return 401 JSON for API routes
            if (isProtectedApi) {
                return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
            }

            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    // Protect /recruit/dashboard and /api/recruit/* (except auth routes) with the
    // separate recruit_token cookie — completely independent from admin_token above.
    const isProtectedRecruitPage = pathname.startsWith('/recruit/dashboard');
    const isProtectedRecruitApi = pathname.startsWith('/api/recruit/') && !pathname.startsWith('/api/recruit/auth/');

    if (isProtectedRecruitPage || isProtectedRecruitApi) {
        const token = request.cookies.get('recruit_token')?.value;

        if (!token) {
            if (isProtectedRecruitApi) {
                return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/recruit/login', request.url));
        }

        try {
            const recruitSecret = new TextEncoder().encode(process.env.RECRUIT_JWT_SECRET || 'fallback_recruit_secret_!@#');
            await jose.jwtVerify(token, recruitSecret);
            return NextResponse.next();
        } catch {
            if (isProtectedRecruitApi) {
                return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/recruit/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    // /signup, /verify are public pre-login flows — no gating needed.
    // /api/member/* routes check role themselves via src/lib/session.ts.
    matcher: ['/dashboard/:path*', '/scanner/:path*', '/recruit-scanner/:path*', '/api/admin/:path*', '/recruit/dashboard/:path*', '/api/recruit/:path*'],
};
