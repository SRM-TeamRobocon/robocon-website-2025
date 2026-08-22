"use client";

// Wraps fetch() for recruit-authenticated actions (tickets, OTP, chat). A raw 401 here is
// ambiguous — it might mean the recruit_token session is genuinely gone, or it might be a
// one-off blip (a request that raced a cookie write, a flaky network hop, a browser/extension
// quirk) that a fresh request sails straight through. Every caller used to treat a 401 as
// "you're logged out" and hard-redirect to /recruit/login on the spot, which turns a transient
// blip into a real, visible logout. This re-checks the session with a cheap GET before trusting
// the 401 — only if THAT also comes back unauthorized is the session actually treated as dead.
export async function recruitFetch(input: string, init?: RequestInit): Promise<Response> {
    const first = await fetch(input, init);
    if (first.status !== 401) return first;

    const recheck = await fetch("/api/recruit/me").catch(() => null);
    if (!recheck || recheck.status === 401) return first;

    // Session is actually fine — the first 401 was transient. Retry once.
    return fetch(input, init);
}
