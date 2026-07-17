import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface SessionClaims {
    user: string;
    role: "lead" | "admin" | "member";
    name?: string;
    domain?: string;
    memberAccountId?: string;
    rosterId?: string | null;
}

async function signSession(claims: SessionClaims, expiresIn: string) {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_robocon_2026_!@#');
    return new SignJWT({ ...claims })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        // Hardcoded credentials as requested — env-based staff accounts are the top-tier "admin" role.
        let userRole: "admin" | null = null;

        try {
            const leads = JSON.parse(process.env.LEAD_ACCOUNTS || '{}');

            if (leads[username] === password) {
                userRole = "admin";
            }
        } catch (e) {
            console.error("Failed to parse account dictionary from .env", e);
            // Fallback for immediate testing
            if (username === "admin" && password === "admin") userRole = "admin";
        }

        if (userRole !== null) {
            const token = await signSession({ user: username, role: userRole }, "12h");

            const response = NextResponse.json({ success: true }, { status: 200 });
            response.cookies.set({
                name: "admin_token",
                value: token,
                httpOnly: true,
                secure: false, // Ensure this works over local HTTP
                sameSite: "lax",
                path: "/",
                maxAge: 60 * 60 * 12, // 12 hours
            });

            return response;
        }

        // Not a staff username — try it as a member email login.
        if (typeof username === "string" && username.includes("@") && password) {
            const supabase = createSupabaseAdminClient();

            const { data: account } = await supabase
                .from("member_accounts")
                .select("id, name, email, domain, password_hash, email_verified, is_approved, role")
                .eq("email", username.trim().toLowerCase())
                .maybeSingle();

            if (account) {
                const passwordMatches = await bcrypt.compare(password, account.password_hash);

                if (!passwordMatches) {
                    return NextResponse.json({ success: false, error: "Invalid username or password" }, { status: 401 });
                }
                if (!account.email_verified) {
                    return NextResponse.json({ success: false, error: "Verify your email before logging in." }, { status: 403 });
                }
                if (!account.is_approved) {
                    return NextResponse.json({ success: false, error: "Your account is awaiting admin approval." }, { status: 403 });
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

                const response = NextResponse.json({ success: true }, { status: 200 });
                response.cookies.set({
                    name: "admin_token",
                    value: token,
                    httpOnly: true,
                    secure: false,
                    sameSite: "lax",
                    path: "/",
                    maxAge,
                });

                return response;
            }
        }

        return NextResponse.json(
            { success: false, error: "Invalid username or password" },
            { status: 401 }
        );
    } catch (error) {
        console.error("Login API error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
