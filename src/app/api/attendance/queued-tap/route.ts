import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { broadcastAttendanceEvent } from "@/lib/attendance";
import { parseQueuedTap, queuedTapReply } from "@/lib/attendance-device";
import { reconcileMidnightAttendance } from "@/lib/attendance-reconcile";
import { sendAttendancePush } from "@/lib/attendance-push";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const secret = process.env.ATTENDANCE_DEVICE_SECRET;
    if (!secret) return new Response("Device secret not configured", { status: 503 });
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
    }
    try {
        const text = await request.text();
        if (text.length > 512) return new Response("Request too large", { status: 413 });
        let body: unknown;
        try { body = JSON.parse(text); } catch { return new Response("Invalid JSON", { status: 400 }); }
        const tap = parseQueuedTap(body);
        if (!tap) return new Response("Invalid tap", { status: 400 });

        const supabase = createSupabaseAdminClient();
        await reconcileMidnightAttendance(supabase);
        const { data, error } = await supabase.rpc("record_queued_attendance_tap", {
            p_event_id: tap.eventId,
            p_device_id: tap.deviceId,
            p_uid: tap.uid,
            p_scanned_at: tap.timestamp ? new Date(tap.timestamp).toISOString() : null,
        });
        if (error) {
            console.error("Queued attendance transaction failed", error.code);
            return new Response("Retry later", { status: 503 });
        }
        const result = data as {
            event: "tap" | "linked" | "unauthorized" | "review";
            action?: "IN" | "OUT"; name?: string; domain?: string;
            memberAccountId?: string; duplicate?: boolean;
        };
        if (!result || !["tap", "linked", "unauthorized", "review"].includes(result.event)) {
            return new Response("Invalid receipt", { status: 503 });
        }
        if (!result.duplicate && (result.event === "tap" || result.event === "linked")) {
            after(async () => {
                await broadcastAttendanceEvent({
                    event: result.event as "tap" | "linked", name: result.name || "Member",
                    domain: result.domain, action: result.action,
                });
                if (result.event === "tap" && result.memberAccountId && result.action) {
                    await sendAttendancePush(result.memberAccountId, result.action).catch(error => {
                        console.error("Queued attendance push failed", error);
                    });
                }
            });
        }
        const reply = queuedTapReply(tap.eventId, result);
        return new Response(reply, { headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Length": String(Buffer.byteLength(reply)),
            "Cache-Control": "no-store",
        } });
    } catch (error) {
        console.error("Queued attendance request failed", error);
        return new Response("Retry later", { status: 503 });
    }
}
