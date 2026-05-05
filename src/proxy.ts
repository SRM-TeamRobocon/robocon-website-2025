import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Protect all /admin UI routes and /api/admin backend routes EXCEPT login paths
    if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && !pathname.includes('/login')) {
        const token = request.cookies.get('admin_token')?.value;

        if (!token) {
            // Return 401 JSON for API routes
            if (pathname.startsWith('/api/admin')) {
                return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
            }

            // Return Redirect for UI routes
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        try {
            // Very basic JWT verification using jose (edge runtime compatible)
            const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_robocon_2026_!@#');
            await jose.jwtVerify(token, secret);
            return NextResponse.next();
        } catch {
            // Invalid token
            // Return 401 JSON for API routes
            if (pathname.startsWith('/api/admin')) {
                return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
            }

            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    // Matcher needs to cover both page routes and api routes
    matcher: ['/admin/:path*', '/api/admin/:path*'],
};
