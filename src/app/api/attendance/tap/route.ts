import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAP_DEBOUNCE_MS, broadcastAttendanceEvent, nextAction, normalizeRfidUid } from "@/lib/attendance";

// Device-facing endpoint for the ESP32 RFID scanner. Not session-gated (the device has
// no cookie) — guarded by a shared secret instead, same pattern as CRON_SECRET in
// /api/attendance/auto-checkout.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ATTENDANCE_DEVICE_SECRET || "local-dev"}`) {
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
        // Unrecognized card — see if someone's actively pairing one from the dashboard.
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
            // Most likely: this UID somehow got bound between our lookups (race) — unique violation.
            console.error("attendance tap: pairing claim failed", claimError);
            return NextResponse.json({ ok: false, event: "unauthorized" });
        }

        await supabase.from("rfid_pairing_requests").update({ status: "claimed" }).eq("id", pending.id);

        const { data: pairedAccount } = await supabase
            .from("member_accounts")
            .select("name")
            .eq("id", pending.member_account_id)
            .maybeSingle();

        const name = pairedAccount?.name || "New card";
        await broadcastAttendanceEvent({ event: "linked", name });
        return NextResponse.json({ ok: true, event: "linked", name });
    }

    // Resolve display identity from the public roster row if this account has one
    // (canonical — avoids the per-tap domain drift the old firmware roster had).
    const { data: roster } = await supabase
        .from("members")
        .select("name, domain")
        .eq("member_account_id", account.id)
        .maybeSingle();
    const name = roster?.name || account.name;
    const domain = roster?.domain || account.domain || "GENERAL";

    const { data: latest, error: latestError } = await supabase
        .from("attendance_logs")
        .select("action, occurred_at")
        .eq("member_account_id", account.id)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestError) {
        console.error("attendance tap: latest log lookup failed", latestError);
        return NextResponse.json({ ok: false, event: "server_error" }, { status: 500 });
    }

    if (latest && Date.now() - Date.parse(latest.occurred_at) < TAP_DEBOUNCE_MS) {
        return NextResponse.json({ ok: true, event: "tap", action: latest.action, name, domain });
    }

    const action = nextAction((latest?.action as "IN" | "OUT" | undefined) ?? null);

    const { error: insertError } = await supabase.from("attendance_logs").insert({
        member_account_id: account.id,
        action,
        source: "rfid",
        device_id: deviceId,
    });

    if (insertError) {
        console.error("attendance tap: insert failed", insertError);
        return NextResponse.json({ ok: false, event: "server_error" }, { status: 500 });
    }

    await broadcastAttendanceEvent({ event: "tap", name, domain, action });

    return NextResponse.json({ ok: true, event: "tap", action, name, domain });
}
