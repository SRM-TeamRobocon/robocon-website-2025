import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Cron-triggered (see vercel.json, "30 18 * * *" = midnight IST). Vercel Cron only ever
// sends GET and injects `Authorization: Bearer $CRON_SECRET` when the env var is named
// exactly CRON_SECRET. Since this fires once per day at day's end, anyone whose latest
// tap is still "IN" gets swept to "OUT" — no stale-duration math needed anymore.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || "local-dev"}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    // Recent window is enough to find everyone's latest tap without scanning the whole table.
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs, error } = await supabase
        .from("attendance_logs")
        .select("member_account_id, action, occurred_at")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false });

    if (error) {
        console.error("auto-checkout: fetch failed", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const latestByMember = new Map<string, string>(); // member_account_id -> action
    for (const log of recentLogs || []) {
        if (!latestByMember.has(log.member_account_id)) {
            latestByMember.set(log.member_account_id, log.action);
        }
    }

    const stillIn = Array.from(latestByMember.entries())
        .filter(([, action]) => action === "IN")
        .map(([memberAccountId]) => memberAccountId);

    if (stillIn.length === 0) {
        return NextResponse.json({ message: "No open sessions found." });
    }

    const { error: insertError } = await supabase.from("attendance_logs").insert(
        stillIn.map((memberAccountId) => ({
            member_account_id: memberAccountId,
            action: "OUT" as const,
            source: "auto_checkout" as const,
            note: "Auto checkout at day end",
        }))
    );

    if (insertError) {
        console.error("auto-checkout: insert failed", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Auto-checked out ${stillIn.length} member(s).` });
}

export const GET = POST;
