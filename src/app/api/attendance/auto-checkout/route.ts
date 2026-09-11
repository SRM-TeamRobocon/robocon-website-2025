import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reconcileMidnightAttendance } from "@/lib/attendance-reconcile";

// Cron is an accelerator only. The attendance board and RFID tap endpoint also run
// this reconciliation, so a delayed or missed cron cannot leave stale IN sessions.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");
    // Fail closed when the env var is missing. The old `|| "local-dev"` fallback meant
    // an unset CRON_SECRET silently turned this into a public endpoint - and for the
    // cron in particular it was worse than that: Vercel only attaches the
    // Authorization header when CRON_SECRET exists, so an unset var meant the real
    // caller got 401 every night while anyone sending "local-dev" got through.
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        if (process.env.NODE_ENV === "production") {
            console.error("CRON_SECRET is not set - refusing the request.");
            return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
        }
        console.warn("CRON_SECRET unset - accepting the local-dev fallback (development only).");
    }
    if (authHeader !== `Bearer ${expected || "local-dev"}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await reconcileMidnightAttendance(createSupabaseAdminClient());
        return NextResponse.json({
            success: true,
            message: `Auto-checked out ${result.checkedOut} member(s); ${result.stayingOvernight} staying overnight.`,
            ...result,
        });
    } catch (error) {
        console.error("auto-checkout failed", error);
        return NextResponse.json({ error: "Could not reconcile attendance." }, { status: 500 });
    }
}

export const GET = POST;
