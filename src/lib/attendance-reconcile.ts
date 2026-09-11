import type { SupabaseClient } from "@supabase/supabase-js";
import { istMidnightBoundary } from "@/lib/attendance";

const LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000;

type ReconcileResult = {
    checkedOut: number;
    stayingOvernight: number;
};

// The scheduler is only an accelerator. Board reads and device taps also call this,
// so a missed or delayed cron cannot leave an old IN state alive indefinitely.
export async function reconcileMidnightAttendance(
    supabase: SupabaseClient,
    nowMs = Date.now()
): Promise<ReconcileResult> {
    const boundaryMs = istMidnightBoundary(nowMs);
    const boundaryIso = new Date(boundaryMs).toISOString();
    const nowIso = new Date(nowMs).toISOString();
    const sinceIso = new Date(boundaryMs - LOOKBACK_MS).toISOString();

    const [{ data: logs, error: logsError }, { data: passes, error: passesError }] = await Promise.all([
        supabase
            .from("attendance_logs")
            .select("member_account_id, action, occurred_at")
            .gte("occurred_at", sinceIso)
            .order("occurred_at", { ascending: false }),
        supabase
            .from("overnight_passes")
            .select("id, member_account_id, expires_at, created_at")
            .eq("status", "active")
            .lte("created_at", boundaryIso),
    ]);

    if (logsError) throw new Error(`attendance reconciliation log lookup failed: ${logsError.message}`);
    if (passesError) throw new Error(`attendance reconciliation pass lookup failed: ${passesError.message}`);

    const latestByMember = new Map<string, { action: "IN" | "OUT"; occurredAt: string }>();
    for (const log of logs || []) {
        if (!latestByMember.has(log.member_account_id)) {
            latestByMember.set(log.member_account_id, {
                action: log.action as "IN" | "OUT",
                occurredAt: log.occurred_at,
            });
        }
    }

    const activePassByMember = new Set(
        (passes || [])
            .filter((pass) => Date.parse(pass.expires_at) > nowMs)
            .map((pass) => pass.member_account_id)
    );
    const stillInAtMidnight = Array.from(latestByMember.entries()).filter(
        ([, latest]) => latest.action === "IN" && Date.parse(latest.occurredAt) < boundaryMs
    );
    const stayingOvernight = stillInAtMidnight.filter(([id]) => activePassByMember.has(id));
    const toCheckOut = stillInAtMidnight.filter(([id]) => !activePassByMember.has(id));

    if (toCheckOut.length > 0) {
        const { error } = await supabase.from("attendance_logs").insert(
            toCheckOut.map(([memberAccountId]) => ({
                member_account_id: memberAccountId,
                action: "OUT" as const,
                source: "auto_checkout" as const,
                note: "Auto checkout at IST midnight",
                occurred_at: nowIso,
            }))
        );
        if (error) throw new Error(`attendance reconciliation insert failed: ${error.message}`);
    }

    const usedPassIds = (passes || [])
        .filter((pass) => stayingOvernight.some(([id]) => id === pass.member_account_id))
        .map((pass) => pass.id);
    const expiredPassIds = (passes || [])
        .filter((pass) => !usedPassIds.includes(pass.id))
        .map((pass) => pass.id);
    for (const [ids, status] of [
        [usedPassIds, "used"],
        [expiredPassIds, "expired"],
    ] as const) {
        if (ids.length === 0) continue;
        const { error } = await supabase
            .from("overnight_passes")
            .update({ status, resolved_at: nowIso })
            .in("id", ids)
            .eq("status", "active");
        if (error) throw new Error(`attendance reconciliation pass update failed: ${error.message}`);
    }

    return { checkedOut: toCheckOut.length, stayingOvernight: stayingOvernight.length };
}