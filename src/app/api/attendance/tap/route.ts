import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAP_DEBOUNCE_MS, broadcastAttendanceEvent, nextAction, normalizeRfidUid } from "@/lib/attendance";

// Device-facing endpoint for the ESP32 RFID scanner. Not session-gated (the device has
// no cookie) - guarded by a shared secret instead, same pattern as CRON_SECRET in
// /api/attendance/auto-checkout.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const authHeader = request.headers.get("authorization");
    // Fail closed when the env var is missing. The old `|| "local-dev"` fallback meant
    // an unset ATTENDANCE_DEVICE_SECRET silently turned this into a public endpoint - and for the
    // cron in particular it was worse than that: Vercel only attaches the
    // Authorization header when ATTENDANCE_DEVICE_SECRET exists, so an unset var meant the real
    // caller got 401 every night while anyone sending "local-dev" got through.
    const expected = process.env.ATTENDANCE_DEVICE_SECRET;
    if (!expected) {
        if (process.env.NODE_ENV === "production") {
            console.error("ATTENDANCE_DEVICE_SECRET is not set - refusing the request.");
            return NextResponse.json({ ok: false, event: "server_error" }, { status: 500 });
        }
        console.warn("ATTENDANCE_DEVICE_SECRET unset - accepting the local-dev fallback (development only).");
    }
    if (authHeader !== `Bearer ${expected || "local-dev"}`) {
        return NextResponse.json({ ok: false, event: "unauthorized_device" }, { status: 401 });
    }

    let body: { uid?: string; deviceId?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false, event: "bad_request" }, { status: 400 });
    }

    const uid = normalizeRfidUid(body.uid || "");
    if (!uid) {
        return NextResponse.json({ ok: false, event: "bad_request" }, { status: 400 });
    }
    const deviceId = body.deviceId ? String(body.deviceId).slice(0, 64) : null;

    const supabase = createSupabaseAdminClient();

    const { data: account, error: accountError } = await supabase
        .from("member_accounts")
        .select("id, name, domain")
        .eq("rfid_uid", uid)
        .maybeSingle();

    if (accountError) {
        console.error("attendance tap: account lookup failed", accountError);
        return NextResponse.json({ ok: false, event: "server_error" }, { status: 500 });
    }

    if (!account) {
        // Unrecognized card - see if someone's actively pairing one from the dashboard.
        const { data: pending, error: pendingError } = await supabase
            .from("rfid_pairing_requests")
            .select("id, member_account_id")
            .eq("status", "pending")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (pendingError) {
            console.error("attendance tap: pairing lookup failed", pendingError);
            return NextResponse.json({ ok: false, event: "server_error" }, { status: 500 });
        }

        if (!pending) {
            return NextResponse.json({ ok: false, event: "unauthorized" });
        }

        const { error: claimError } = await supabase
            .from("member_accounts")
            .update({ rfid_uid: uid })
            .eq("id", pending.member_account_id);

        if (claimError) {
            // Most likely: this UID somehow got bound between our lookups (race) - unique violation.
            console.error("attendance tap: pairing claim failed", claimError);
            return NextResponse.json({ ok: false, event: "unauthorized" });
        }

        await supabase.from("rfid_pairing_requests").update({ status: "claimed" }).eq("id", pending.id);

        // Resolve the same way a normal tap does - roster first, account name as
        // fallback - so the name on the pairing screen matches the name shown on every
        // tap afterwards instead of drifting the moment a roster entry is edited.
        const [{ data: pairedRoster }, { data: pairedAccount }] = await Promise.all([
            supabase.from("members").select("name").eq("member_account_id", pending.member_account_id).maybeSingle(),
            supabase.from("member_accounts").select("name").eq("id", pending.member_account_id).maybeSingle(),
        ]);

        const name = pairedRoster?.name || pairedAccount?.name || "New card";
        await broadcastAttendanceEvent({ event: "linked", name });
        return NextResponse.json({ ok: true, event: "linked", name });
    }

    // Both of these need only account.id, so they go together. Run sequentially this
    // costs an extra Supabase round trip, and a round trip here measures 300-900ms -
    // the single biggest term in how long a member stands at the reader waiting.
    //
    // Resolve display identity from the public roster row if this account has one
    // (canonical - avoids the per-tap domain drift the old firmware roster had).
    const [{ data: roster }, { data: latest, error: latestError }] = await Promise.all([
        supabase.from("members").select("name, domain").eq("member_account_id", account.id).maybeSingle(),
        supabase
            .from("attendance_logs")
            .select("action, occurred_at")
            .eq("member_account_id", account.id)
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const name = roster?.name || account.name;
    const domain = roster?.domain || account.domain || "GENERAL";

    if (latestError) {
        console.error("attendance tap: latest log lookup failed", latestError);
        return NextResponse.json({ ok: false, event: "server_error" }, { status: 500 });
    }

    if (latest && Date.now() - Date.parse(latest.occurred_at) < TAP_DEBOUNCE_MS) {
        return NextResponse.json({ ok: true, event: "tap", action: latest.action, name, domain });
    }

    const action = nextAction((latest?.action as "IN" | "OUT" | undefined) ?? null);

    // The broadcast only needs name/domain/action, all of which are already known, so
    // it overlaps with the insert instead of queueing behind it. It's still awaited -
    // a serverless function can be frozen the moment it responds, so fire-and-forget
    // would drop the live board's update - but it no longer costs the device any time.
    const broadcast = broadcastAttendanceEvent({ event: "tap", name, domain, action });

    const { error: insertError } = await supabase.from("attendance_logs").insert({
        member_account_id: account.id,
        action,
        source: "rfid",
        device_id: deviceId,
    });

    await broadcast;

    if (insertError) {
        console.error("attendance tap: insert failed", insertError);
        return NextResponse.json({ ok: false, event: "server_error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, event: "tap", action, name, domain });
}
