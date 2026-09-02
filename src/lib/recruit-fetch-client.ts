"use client";

// Wraps fetch() for recruit-authenticated actions (tickets, OTP, chat).
//
// A raw 401 is ambiguous: it might mean the recruit_token session is genuinely gone, or it
// might be a one-off blip (a request that raced a cookie write, a flaky network hop, a
// browser/extension quirk) that a fresh request sails straight through. Callers treat a 401
// as "you're logged out" and send the recruit to /recruit/login, so a blip that reaches them
// becomes a real, visible logout - with whatever they were typing thrown away.
//
// The contract this wrapper gives callers: **a 401 coming out of recruitFetch means the
// session is confirmed dead.** Anything we could not prove is a dead session is converted
// into a transient 503 instead, so the `res.status === 401` branch in a caller only ever
// fires when signing the recruit out is genuinely the right thing to do.

// Not a real HTTP round trip - a synthetic response shaped like every other error body in
// the recruit API ({ success, error }), so existing callers render it through their normal
// "show the error" path with no special-casing.
function transientFailure(message: string): Response {
    return new Response(JSON.stringify({ success: false, error: message }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
    });
}

export async function recruitFetch(input: string, init?: RequestInit): Promise<Response> {
    const first = await fetch(input, init);
    if (first.status !== 401) return first;

    // Cheap, DB-free probe (see src/app/api/recruit/session-check/route.ts) - deliberately
    // not /api/recruit/me, which is heavy enough to time out under load and produce exactly
    // the false "logged out" this check is meant to rule out.
    const probe = await fetch("/api/recruit/session-check").catch(() => null);

    // The probe itself came back unauthorized: the session really is gone. This is the ONLY
    // path that hands a 401 back to the caller.
    if (probe && probe.status === 401) return first;

    // The probe never completed (offline, timeout, blocked request). We have not established
    // that the session is dead, and guessing "dead" here is what turns a weak connection into
    // a forced sign-out - the single most likely cause of recruits being bounced mid-ticket.
    if (!probe) {
        return transientFailure("Connection problem - you're still signed in. Please try again.");
    }

    // Probe says the session is alive, so the original 401 was a blip. Retry once.
    const retry = await fetch(input, init);
    if (retry.status !== 401) return retry;

    // Retried with a session the probe just confirmed is valid, and still 401 - something is
    // wrong server-side, but "your session is dead" is not a claim we can support, so don't
    // sign them out over it.
    return transientFailure("Something went wrong on our end - you're still signed in. Please try again.");
}
