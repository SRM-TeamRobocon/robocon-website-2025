import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendMemberPush } from "@/lib/attendance-push";
import { sendMemberNotificationEmail } from "@/lib/member-notification-email";

export const dynamic = "force-dynamic";

const REMINDER_INTERVAL_MS = 4 * 60 * 60 * 1000;

function authorized(request: Request) {
    const expected = process.env.CRON_SECRET;
    if (!expected && process.env.NODE_ENV === "production") return false;
    return request.headers.get("authorization") === `Bearer ${expected || "local-dev"}`;
}

export async function POST(request: Request) {
    if (!authorized(request)) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
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
        const checkedInAt = Date.parse(log.occurred_at);
        const lastReminderAt = log.last_long_stay_reminder_at ? Date.parse(log.last_long_stay_reminder_at) : null;
        return log.action === "IN"
            && checkedInAt <= now - REMINDER_INTERVAL_MS
            && (!lastReminderAt || lastReminderAt <= now - REMINDER_INTERVAL_MS);
    });

    let reminded = 0;
    await Promise.all(candidates.map(async (log) => {
        let claimQuery = supabase
            .from("attendance_logs")
            .update({ last_long_stay_reminder_at: new Date(now).toISOString() })
            .eq("id", log.id)
            .eq("action", "IN");
        claimQuery = log.last_long_stay_reminder_at
            ? claimQuery.eq("last_long_stay_reminder_at", log.last_long_stay_reminder_at)
            : claimQuery.is("last_long_stay_reminder_at", null);
        const { data: claim, error: claimError } = await claimQuery.select("id").maybeSingle();
        if (claimError) {
            console.error("attendance reminders: claim failed", { logId: log.id, claimError });
            return;
        }
        if (!claim) return;

        const { data: account, error: accountError } = await supabase
            .from("member_accounts")
            .select("name, email, google_email")
            .eq("id", log.member_account_id)
            .maybeSingle();

        if (accountError || !account) {
            console.error("attendance reminders: account lookup failed", { memberAccountId: log.member_account_id, accountError });
            return;
        }

        const message = "You have been checked in for more than four hours. Please tap out when you leave.";
        await Promise.all([
            sendMemberPush(log.member_account_id, {
                title: "Please tap out",
                body: message,
                tag: `lab-attendance-reminder-${log.id}-${now}`,
            }),
            sendMemberNotificationEmail(
                [account.email, account.google_email || ""],
                account.name,
                "Attendance reminder: please tap out",
                message
            ),
        ]);

        reminded++;
    }));

    return NextResponse.json({ success: true, reminded });
}

export const GET = POST;
