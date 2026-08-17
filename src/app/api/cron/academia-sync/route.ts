import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Cron-triggered (see vercel.json), same Authorization: Bearer $CRON_SECRET guard as
// /api/attendance/auto-checkout. Mirrors SRM's published Day Order calendar into
// day_order_log so the timetable UI can answer "which DO is today?".
//
// This does NOT scrape Academia. edutechsrm (an unofficial third-party wrapper) exposes
// the whole academic planner as plain JSON at GET /api/calendar, keyed date -> day order:
//
//     "date_to_day_order": { "2026-08-17": 5, "2026-08-18": 1, ... }
//
// which is the entire semester in one call — so this route is a periodic *reconciliation*
// of a published calendar, not a daily scrape whose failure blacks out the feature. That
// avoids the headless-browser path entirely (no puppeteer-core/@sparticuz/chromium, no
// Zoho SSO iframe, no "Maximum concurrent sessions" interstitial).
//
// Two things about the upstream worth knowing:
//   - It echoes the submitted credentials back in the response body (`_username` /
//     `_password`, plaintext), i.e. it stores the password rather than a hash. Never log
//     a raw response from it, and treat ACADEMIA_BOT_PASSWORD as disclosed to that host —
//     it must be a dedicated bot account, never a personal login.
//   - Coverage stops at the last published planner (as of 2026-08-17: 2026-12-07; the
//     2026_27_EVEN planner exists but is empty). Dates past that simply won't appear —
//     hence PATCH /api/admin/day-order as the manual backstop.
//
// Holidays and weekends are absent from the upstream map rather than zero-valued, so a
// missing date correctly means "no day order", and we write no row for it.
export const dynamic = "force-dynamic";

const ACADEMIA_API_URL =
    process.env.ACADEMIA_API_URL || "https://edutechsrm-backend.goelaarav777.workers.dev";

const VALID_DAY_ORDERS = new Set([1, 2, 3, 4, 5]);

type DayOrderRow = { date: string; day_order: string };

async function fetchDayOrderSchedule(): Promise<DayOrderRow[]> {
    const username = process.env.ACADEMIA_BOT_USERNAME;
    const password = process.env.ACADEMIA_BOT_PASSWORD;
    if (!username || !password) {
        console.warn("academia-sync: ACADEMIA_BOT_USERNAME/PASSWORD not configured, skipping.");
        return [];
    }

    const loginRes = await fetch(`${ACADEMIA_API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
    });

    if (!loginRes.ok) {
        // Deliberately not echoing the body — see the credential-echo note above.
        throw new Error(`academia-sync: login failed (${loginRes.status}).`);
    }

    const loginJson = await loginRes.json();
    const token = loginJson?.token;
    if (typeof token !== "string" || !token) {
        throw new Error("academia-sync: login response had no token.");
    }

    const calendarRes = await fetch(`${ACADEMIA_API_URL}/api/calendar`, {
        headers: { "x-access-token": token },
        cache: "no-store",
    });

    if (!calendarRes.ok) {
        throw new Error(`academia-sync: calendar fetch failed (${calendarRes.status}).`);
    }

    const calendarJson = await calendarRes.json();
    const map = calendarJson?.date_to_day_order;
    if (!map || typeof map !== "object") {
        throw new Error("academia-sync: calendar response had no date_to_day_order map.");
    }

    const rows: DayOrderRow[] = [];
    for (const [date, value] of Object.entries(map as Record<string, unknown>)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

        const dayOrder = typeof value === "number" ? value : Number(value);
        // Anything outside 1..5 (nulls, holiday markers, a format change upstream) is
        // dropped rather than guessed — the day_order CHECK constraint would reject it
        // anyway, and one bad entry shouldn't fail the whole batch.
        if (!VALID_DAY_ORDERS.has(dayOrder)) continue;

        rows.push({ date, day_order: `DO${dayOrder}` });
    }

    return rows;
}

export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || "local-dev"}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let rows: DayOrderRow[];
    try {
        rows = await fetchDayOrderSchedule();
    } catch (error) {
        console.error("academia-sync: fetch failed", error);
        return NextResponse.json({ success: false, message: "Fetch failed, left day_order_log untouched." });
    }

    if (rows.length === 0) {
        return NextResponse.json({ success: false, message: "No day orders fetched, left day_order_log untouched." });
    }

    const supabase = createSupabaseAdminClient();

    // A lead's manual override wins permanently: the upstream planner is a *published*
    // schedule, and when the university shuffles a day order mid-semester the override is
    // the correction. Re-syncing must not quietly undo it.
    const { data: manualRows, error: manualError } = await supabase
        .from("day_order_log")
        .select("date")
        .eq("source", "manual");

    if (manualError) {
        console.error("academia-sync: could not read manual overrides", manualError);
        return NextResponse.json({ success: false, error: manualError.message }, { status: 500 });
    }

    const manualDates = new Set((manualRows || []).map((row) => row.date));
    const syncedAt = new Date().toISOString();
    const payload = rows
        .filter((row) => !manualDates.has(row.date))
        .map((row) => ({ ...row, source: "academia_sync" as const, synced_at: syncedAt }));

    // Chunked so a full-year backfill (~300 rows) stays well inside PostgREST's payload
    // limits; steady-state re-syncs are the same rows again, which is the point — the
    // upsert is idempotent on `date`.
    const CHUNK_SIZE = 100;
    let written = 0;

    for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("day_order_log").upsert(chunk, { onConflict: "date" });

        if (error) {
            console.error("academia-sync: upsert failed", error);
            return NextResponse.json(
                { success: false, error: error.message, written },
                { status: 500 }
            );
        }

        written += chunk.length;
    }

    return NextResponse.json({
        success: true,
        fetched: rows.length,
        written,
        skippedManual: rows.length - payload.length,
    });
}

export const GET = POST;
