import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { getTransporter, SMTP_EMAIL, logoAttachment } from "@/lib/mailer";
import { buildBulkMailHtml } from "@/lib/recruit-bulk-mail-email";
import { boundedText } from "@/lib/recruit-validation";

export const dynamic = "force-dynamic";

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;
// Bounds a single request to roughly one active cycle's worth of recruits. Larger blasts
// should be sent as a few filtered batches rather than one request that risks a serverless
// function timeout mid-send.
const MAX_RECIPIENTS = 3000;
// Gmail SMTP throttles bursts — sending the whole batch via Promise.all would open
// thousands of sockets at once. Small concurrent chunks keep this well under that.
const SEND_CONCURRENCY = 5;

// POST /api/admin/recruitment/send-mail — bulk-email selected recruits in the active cycle
// with an admin-composed subject/body and an optional date & time (e.g. an interview slot
// or deadline) rendered into the email.
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const recruitIds = Array.isArray(body.recruit_ids)
        ? Array.from(new Set(body.recruit_ids.map((id: unknown) => String(id))))
        : [];
    const subject = boundedText(body.subject, MAX_SUBJECT_LENGTH);
    const message = boundedText(body.body, MAX_BODY_LENGTH);
    const eventAtRaw = body.event_at ? String(body.event_at) : "";

    if (recruitIds.length === 0) {
        return NextResponse.json({ success: false, error: "Select at least one recruit." }, { status: 400 });
    }
    if (recruitIds.length > MAX_RECIPIENTS) {
        return NextResponse.json(
            { success: false, error: `Too many recipients selected (max ${MAX_RECIPIENTS} per send).` },
            { status: 400 }
        );
    }
    if (!subject || !message) {
        return NextResponse.json({ success: false, error: "Subject and message are required." }, { status: 400 });
    }

    let eventAt: Date | null = null;
    if (eventAtRaw) {
        const parsed = new Date(eventAtRaw);
        if (Number.isNaN(parsed.getTime())) {
            return NextResponse.json({ success: false, error: "Invalid date & time." }, { status: 400 });
        }
        eventAt = parsed;
    }

    const transporter = getTransporter();
    if (!transporter) {
        return NextResponse.json({ success: false, error: "Email is not configured on this server." }, { status: 503 });
    }

    const supabase = createRecruitSupabaseAdminClient();

    const { data: cycle } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
    if (!cycle) {
        return NextResponse.json({ success: false, error: "No active recruitment cycle." }, { status: 503 });
    }

    // Scoped to the active cycle so an id list can't be reused to mail recruits from a
    // past/inactive cycle.
    const { data: recruits, error: recruitsError } = await supabase
        .from("recruit_accounts")
        .select("id, name, srm_email, personal_email")
        .eq("cycle_id", cycle.id)
        .in("id", recruitIds);

    if (recruitsError) {
        console.error("send-mail recruits lookup error", recruitsError);
        return NextResponse.json({ success: false, error: "Could not load selected recruits." }, { status: 500 });
    }
    if (!recruits || recruits.length === 0) {
        return NextResponse.json({ success: false, error: "None of the selected recruits were found." }, { status: 404 });
    }

    const eventLabel = eventAt
        ? eventAt.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" })
        : null;

    const failures: { recruit_id: string; name: string; error: string }[] = [];
    let sent = 0;

    for (let i = 0; i < recruits.length; i += SEND_CONCURRENCY) {
        const batch = recruits.slice(i, i + SEND_CONCURRENCY);
        const results = await Promise.allSettled(
            batch.map(async (r: { id: string; name: string; srm_email: string | null; personal_email: string | null }) => {
                const recipients = Array.from(
                    new Set([r.srm_email, r.personal_email].filter((e): e is string => !!e).map((e) => e.toLowerCase()))
                );
                if (recipients.length === 0) throw new Error("No email on file");

                await transporter.sendMail({
                    from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
                    to: recipients,
                    subject,
                    text: message + (eventLabel ? `\n\nDate & Time: ${eventLabel}` : ""),
                    html: buildBulkMailHtml({ name: r.name, subject, message, eventLabel }),
                    attachments: [logoAttachment()],
                });
            })
        );

        results.forEach((result, idx) => {
            if (result.status === "fulfilled") {
                sent += 1;
            } else {
                const r = batch[idx];
                const reason = result.reason instanceof Error ? result.reason.message : "Send failed";
                failures.push({ recruit_id: r.id, name: r.name, error: reason });
            }
        });
    }

    return NextResponse.json({ success: true, sent, failed: failures.length, failures });
}
