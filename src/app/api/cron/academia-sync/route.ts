import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Cron-triggered (see vercel.json), same Authorization: Bearer $CRON_SECRET guard as
// /api/attendance/auto-checkout. Meant to log into SRM Academia (or edutechsrm.in, an
// unofficial third-party wrapper that reads Academia data — see notes below) with a
// single shared bot account (ACADEMIA_BOT_USERNAME/ACADEMIA_BOT_PASSWORD env vars —
// Day Order is university-wide, so one account covers everyone; never store
// per-member credentials for this) and record today's Day Order into day_order_log.
//
// scrapeTodaysDayOrder() is intentionally unimplemented. What's been confirmed so far
// (2026-08-17, manual + Puppeteer investigation):
//   - Official login (https://academia.srmist.edu.in) is Zoho SSO inside an iframe at
//     .../accounts/p/<id>/signin: fill #login_id (full email, e.g. user@srmist.edu.in)
//     -> click #nextbtn -> fill #password -> click the "Sign In" button. The bot
//     account's credentials are valid and were confirmed working this far.
//   - That flow can land on an interstitial ("Maximum concurrent sessions limit
//     exceeded" with a "Terminate All Sessions" button) if the account is already
//     logged in elsewhere — expect to handle that, but note it forcibly signs out
//     whichever human is using that account elsewhere, so this should be a genuinely
//     dedicated/unused bot account, not someone's daily-driver login.
//   - edutechsrm.in/app is an unofficial third-party dashboard ("password never
//     stored") that shows Day Order directly in its header (e.g. "# DO 5") after
//     connecting an Academia account — a much smaller scrape surface than Academia's
//     own dashboard, at the cost of depending on a third party. Its own login/connect
//     flow (behind a "Connect SRM Academia" button) was not fully inspected — that's
//     the next step, along with checking whether it exposes the Day Order via a plain
//     authenticated JSON endpoint (inspect the Network tab after logging in manually)
//     rather than needing a full headless browser at all.
//   - Automating either login flow needs a headless browser in production
//     (puppeteer-core + @sparticuz/chromium on Vercel; `puppeteer` full package is
//     already installed as a devDependency for local testing).
// Until this is filled in, the route no-ops safely — lead/admin can set today's Day
// Order manually via PATCH /api/admin/day-order in the meantime.
export const dynamic = "force-dynamic";

async function scrapeTodaysDayOrder(): Promise<string | null> {
    const username = process.env.ACADEMIA_BOT_USERNAME;
    const password = process.env.ACADEMIA_BOT_PASSWORD;
    if (!username || !password) {
        console.warn("academia-sync: ACADEMIA_BOT_USERNAME/PASSWORD not configured, skipping.");
        return null;
    }

    // TODO: implement — see investigation notes above for the login flow and the
    // edutechsrm.in shortcut. Check for a plain JSON API first before reaching for a
    // headless browser.
    console.warn("academia-sync: scrapeTodaysDayOrder() not yet implemented.");
    return null;
}

function todayIST(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || "local-dev"}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let dayOrder: string | null = null;
    try {
        dayOrder = await scrapeTodaysDayOrder();
    } catch (error) {
        console.error("academia-sync: scrape failed", error);
        return NextResponse.json({ success: false, message: "Scrape failed, left day_order_log untouched." });
    }

    if (!dayOrder) {
        return NextResponse.json({ success: false, message: "No day order scraped, left day_order_log untouched." });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
        .from("day_order_log")
        .upsert(
            { date: todayIST(), day_order: dayOrder, source: "academia_sync", synced_at: new Date().toISOString() },
            { onConflict: "date" }
        );

    if (error) {
        console.error("academia-sync: upsert failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, dayOrder });
}

export const GET = POST;
