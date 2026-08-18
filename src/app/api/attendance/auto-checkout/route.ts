import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Cron-triggered (see vercel.json, "30 18 * * *" = midnight IST). Vercel Cron only ever
// sends GET and injects `Authorization: Bearer $CRON_SECRET` when the env var is named
// exactly CRON_SECRET. Since this fires once per day at day's end, anyone whose latest
// tap is still "IN" gets swept to "OUT" — no stale-duration math needed anymore.
//
// Exception: members holding an active overnight pass are left checked in for this one
// sweep. Every active pass is resolved here regardless of whether it was used, which is
// what makes a pass strictly one night — it can't still be active at the next sweep.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");
    // Fail closed when the env var is missing. The old `|| "local-dev"` fallback meant
    // an unset CRON_SECRET silently turned this into a public endpoint — and for the
    // cron in particular it was worse than that: Vercel only attaches the
    // Authorization header when CRON_SECRET exists, so an unset var meant the real
    // caller got 401 every night while anyone sending "local-dev" got through.
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        if (process.env.NODE_ENV === "production") {
            console.error("CRON_SECRET is not set — refusing the request.");
            return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
        }
        console.warn("CRON_SECRET unset — accepting the local-dev fallback (development only).");
    }
    if (authHeader !== `Bearer ${expected || "local-dev"}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    // Recent window is enough to find everyone's latest tap without scanning the whole table.
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: recentLogs, error }, { data: activePasses, error: passError }] = await Promise.all([
        supabase
            .from("attendance_logs")
            .select("member_account_id, action, occurred_at")
            .gte("occurred_at", since)
            .order("occurred_at", { ascending: false }),
        supabase.from("overnight_passes").select("id, member_account_id, expires_at").eq("status", "active"),
    ]);

    if (error) {
        console.error("auto-checkout: fetch failed", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (passError) {
        // Without the pass list we'd sweep out people who explicitly said they're
        // staying — that's worse than skipping tonight's sweep entirely.
        console.error("auto-checkout: overnight pass fetch failed", passError);
        return NextResponse.json({ error: passError.message }, { status: 500 });
    }

    // A pass past its backstop expiry no longer grants the exemption (it only survived
    // this long because a previous sweep never ran), but it still gets resolved below.
    const exemptMemberIds = new Set(
        (activePasses || []).filter((p) => Date.parse(p.expires_at) > Date.now()).map((p) => p.member_account_id)
    );

    const latestByMember = new Map<string, string>(); // member_account_id -> action
    for (const log of recentLogs || []) {
        if (!latestByMember.has(log.member_account_id)) {
            latestByMember.set(log.member_account_id, log.action);
        }
    }

    const stillIn = Array.from(latestByMember.entries())
        .filter(([, action]) => action === "IN")
        .map(([memberAccountId]) => memberAccountId);

    const stayingOvernight = stillIn.filter((id) => exemptMemberIds.has(id));
    const toCheckOut = stillIn.filter((id) => !exemptMemberIds.has(id));

    if (toCheckOut.length > 0) {
        const { error: insertError } = await supabase.from("attendance_logs").insert(
            toCheckOut.map((memberAccountId) => ({
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
    }

    // Burn every pass this sweep saw. 'used' for the people it actually kept checked
    // in, 'expired' for passes claimed by someone who ended up tapping out normally
    // (or never came in) — either way none of them reach tomorrow's sweep.
    const usedPassIds = (activePasses || [])
        .filter((p) => stayingOvernight.includes(p.member_account_id))
        .map((p) => p.id);
    const expiredPassIds = (activePasses || []).filter((p) => !usedPassIds.includes(p.id)).map((p) => p.id);

    for (const [ids, status] of [
        [usedPassIds, "used"],
        [expiredPassIds, "expired"],
    ] as const) {
        if (ids.length === 0) continue;
        const { error: passUpdateError } = await supabase
            .from("overnight_passes")
            .update({ status, resolved_at: nowIso })
            .in("id", ids);
        if (passUpdateError) {
            // Non-fatal: the checkouts above already landed, and the backstop expiry
            // keeps a stuck pass from covering nights forever.
            console.error(`auto-checkout: could not mark passes ${status}`, passUpdateError);
        }
    }

    return NextResponse.json({
        success: true,
        message: `Auto-checked out ${toCheckOut.length} member(s); ${stayingOvernight.length} staying overnight.`,
        checkedOut: toCheckOut.length,
        stayingOvernight: stayingOvernight.length,
    });
}

export const GET = POST;
