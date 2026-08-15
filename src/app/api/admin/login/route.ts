import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminCookieOptions, signSession } from "@/lib/session";
import { MEMBER_GOOGLE_PENDING_COOKIE, verifyPendingGoogleProfile } from "@/lib/member-oauth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
            response.cookies.set({ ...adminCookieOptions(60 * 60 * 12), value: token });

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

                // If they arrived here via "Sign in with Google" not matching any account,
                // a pending Google profile was stashed in a short-lived cookie — a successful
                // password login is the signal to link it now, so the connection happens
                // without a separate trip to the dashboard.
                let linkedGoogleEmail: string | null = null;
                const pendingToken = request.cookies.get(MEMBER_GOOGLE_PENDING_COOKIE)?.value;
                if (pendingToken) {
                    const pending = await verifyPendingGoogleProfile(pendingToken);
                    if (pending) {
                        const { data: conflict } = await supabase
                            .from("member_accounts")
                            .select("id")
                            .eq("google_uid", pending.google_uid)
                            .neq("id", account.id)
                            .maybeSingle();

                        if (!conflict) {
                            const { error: linkError } = await supabase
                                .from("member_accounts")
                                .update({ google_uid: pending.google_uid, google_email: pending.google_email })
                                .eq("id", account.id);
                            if (!linkError) linkedGoogleEmail = pending.google_email;
                        }
                    }
                }

                const response = NextResponse.json({ success: true, linkedGoogleEmail }, { status: 200 });
                response.cookies.set({ ...adminCookieOptions(maxAge), value: token });
                if (pendingToken) {
                    response.cookies.set({ name: MEMBER_GOOGLE_PENDING_COOKIE, value: "", path: "/", maxAge: 0 });
                }

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
