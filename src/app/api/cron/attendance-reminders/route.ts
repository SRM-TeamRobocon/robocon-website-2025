import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendMemberPush } from "@/lib/attendance-push";
import { sendAttendanceReminderEmail } from "@/lib/member-notification-email";

export const dynamic = "force-dynamic";

const INDIA_TIME_ZONE = "Asia/Kolkata";

function authorized(request: Request) {
    const expected = process.env.CRON_SECRET;
    if (!expected && process.env.NODE_ENV === "production") return false;
    return request.headers.get("authorization") === `Bearer ${expected || "local-dev"}`;
}

export async function POST(request: Request) {
    if (!authorized(request)) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const indiaDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: INDIA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
    const supabase = createSupabaseAdminClient();
    const { data: logs, error: logsError } = await supabase
        .from("attendance_logs")
        .select("id, member_account_id, action, occurred_at, last_long_stay_reminder_at")
        .order("occurred_at", { ascending: false })
        .limit(10000);

    if (logsError) {
        console.error("attendance reminders: log lookup failed", logsError);
        return NextResponse.json({ success: false, error: "Could not load attendance sessions." }, { status: 500 });
    }

    const latestByMember = new Map<string, (typeof logs)[number]>();
    for (const log of logs || []) {
        if (!latestByMember.has(log.member_account_id)) latestByMember.set(log.member_account_id, log);
    }

    const candidates = Array.from(latestByMember.values()).filter((log) => {
        const lastReminderDate = log.last_long_stay_reminder_at
            ? new Intl.DateTimeFormat("en-CA", {
                timeZone: INDIA_TIME_ZONE,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).format(new Date(log.last_long_stay_reminder_at))
            : null;
        return log.action === "IN" && lastReminderDate !== indiaDate;
    });

    const claimed = (await Promise.all(candidates.map(async (log) => {
        let claimQuery = supabase
            .from("attendance_logs")
            .update({ last_long_stay_reminder_at: now.toISOString() })
            .eq("id", log.id)
            .eq("action", "IN");
        if (log.last_long_stay_reminder_at) {
            claimQuery = claimQuery.eq("last_long_stay_reminder_at", log.last_long_stay_reminder_at);
        } else {
            claimQuery = claimQuery.is("last_long_stay_reminder_at", null);
        }
        const { data: claim, error: claimError } = await claimQuery.select("id").maybeSingle();
        if (claimError) {
            console.error("attendance reminders: claim failed", { logId: log.id, claimError });
            return null;
        }
        return claim ? log : null;
    }))).filter((log): log is (typeof candidates)[number] => Boolean(log));

    if (claimed.length === 0) {
        return NextResponse.json({ success: true, reminded: 0 });
    }

    const memberIds = claimed.map((log) => log.member_account_id);
    const { data: accounts, error: accountError } = await supabase
        .from("member_accounts")
        .select("id, email, google_email")
        .in("id", memberIds);

    if (accountError) {
        console.error("attendance reminders: account lookup failed", accountError);
        return NextResponse.json({ success: false, error: "Could not load member accounts." }, { status: 500 });
    }

    const recipients = (accounts || []).flatMap((account) => [account.email, account.google_email || ""]);
    await Promise.all(claimed.map((log) => sendMemberPush(log.member_account_id, {
        title: "Please tap out",
        body: "Still in the lab? If you forgot to tap out, tap out now so you are not added to the ghost board.",
        tag: `lab-attendance-reminder-${log.id}-${now.getTime()}`,
    })));
    const emailSent = await sendAttendanceReminderEmail(recipients);

    return NextResponse.json({
        success: true,
        reminded: claimed.length,
        pushRecipients: accounts?.length || 0,
        emailSent,
    });
}

export const GET = POST;
