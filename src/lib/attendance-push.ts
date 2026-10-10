import { randomInt } from "node:crypto";
import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CHECK_IN_MESSAGES = [
    "Welcome Dawg",
    "Lesgooo",
    "Ur In Cutie",
    "Locked In Bb",
    "Welcome Back",
    "Ayyy Ur In",
    "In The Building",
    "Slay Ur In",
];

const CHECK_OUT_MESSAGES = [
    "Fuck Off Dude",
    "Byeee Bestie",
    "Ghosted Lol",
    "Cya Nerd",
    "Dipped Out",
    "Later Gator",
    "Peace Out",
    "Get Home Safe",
];

function pushConfig() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export function getAttendancePushPublicKey() {
    return pushConfig()?.publicKey ?? null;
}

export async function sendAttendancePush(memberAccountId: string, action: "IN" | "OUT") {
    const config = pushConfig();
    if (!config) {
        console.warn("Attendance push skipped: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT is missing.");
        return;
    }

    const supabase = createSupabaseAdminClient();
    const { data: subscriptions, error } = await supabase
        .from("attendance_push_subscriptions")
        .select("endpoint, endpoint_hash, p256dh, auth, expiration_time")
        .eq("member_account_id", memberAccountId);

    if (error) {
        console.error("Attendance push: subscription lookup failed", error);
        return;
    }
    if (!subscriptions?.length) return;

    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

    const messages = action === "IN" ? CHECK_IN_MESSAGES : CHECK_OUT_MESSAGES;
    const payload = JSON.stringify({
        title: action === "IN" ? "Lab check-in" : "Lab check-out",
        body: messages[randomInt(messages.length)],
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-monochrome-192.png",
        tag: `lab-attendance-${action.toLowerCase()}-${Date.now()}`,
        url: "/dashboard/attendance",
    });

    await Promise.all(subscriptions.map(async (row) => {
        try {
            await webpush.sendNotification({
                endpoint: row.endpoint,
                expirationTime: row.expiration_time,
                keys: { p256dh: row.p256dh, auth: row.auth },
            }, payload, { TTL: 60 });
        } catch (sendError) {
            const statusCode = typeof sendError === "object" && sendError !== null && "statusCode" in sendError
                ? Number(sendError.statusCode)
                : null;
            if (statusCode === 404 || statusCode === 410) {
                const { error: deleteError } = await supabase
                    .from("attendance_push_subscriptions")
                    .delete()
                    .eq("member_account_id", memberAccountId)
                    .eq("endpoint_hash", row.endpoint_hash);
                if (deleteError) console.error("Attendance push: expired subscription cleanup failed", deleteError);
                return;
            }
            console.error("Attendance push delivery failed", { statusCode });
        }
    }));
}
