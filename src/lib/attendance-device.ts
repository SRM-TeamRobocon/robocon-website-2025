export type QueuedTap = {
    eventId: string;
    deviceId: string;
    uid: string;
    timestamp: number;
};

export function parseQueuedTap(body: unknown): QueuedTap | null {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const tap = body as Record<string, unknown>;
    if (typeof tap.eventId !== "string" || !/^[a-f0-9]{32}$/.test(tap.eventId) ||
        typeof tap.deviceId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(tap.deviceId) ||
        typeof tap.uid !== "string" || !/^(?:[A-F0-9]{8}|[A-F0-9]{14}|[A-F0-9]{20})$/.test(tap.uid) ||
        typeof tap.timestamp !== "number" || !Number.isSafeInteger(tap.timestamp) ||
        tap.timestamp < 0 || tap.timestamp > 4_102_444_800_000) return null;
    return tap as QueuedTap;
}

export function queuedTapReply(eventId: string, result: { event: string; action?: string; name?: string }): string {
    // Fixed ASCII fields keep the LCD protocol tiny and prevent injected separators.
    const name = (result.name || "").replace(/[^\x20-\x7e]/g, " ").slice(0, 16);
    return `${eventId}\n${result.event}\n${result.action || ""}\n${name}`;
}
