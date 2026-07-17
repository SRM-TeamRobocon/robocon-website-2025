import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/scanner');
    const isProtectedApi = pathname.startsWith('/api/admin') && pathname !== '/api/admin/login';

    // Protect /dashboard, /scanner (UI) and /api/admin (backend) routes — everything else is public
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

    return NextResponse.next();
}

export const config = {
    // /signup, /verify are public pre-login flows — no gating needed.
    // /api/member/* routes check role themselves via src/lib/session.ts.
    matcher: ['/dashboard/:path*', '/scanner/:path*', '/api/admin/:path*'],
};
