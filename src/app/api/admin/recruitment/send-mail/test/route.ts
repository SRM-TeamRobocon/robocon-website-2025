import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { boundedText } from "@/lib/recruit-validation";
import { getRecruitmentBulkMailTransporter, RECRUIT_BULK_MAIL_FROM, logoAttachment, sendMailWithRetry } from "@/lib/mailer";
import { buildBulkMailHtml } from "@/lib/recruit-bulk-mail-email";
import { MAX_SUBJECT_LENGTH, MAX_BODY_LENGTH, formatEventLabel } from "@/lib/recruit-bulk-mail-jobs";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/admin/recruitment/send-mail/test - sends the composed email to a single
// admin-supplied address, using the exact same transporter/template as a real job, so a lead
// can check formatting/deliverability in their own inbox before selecting hundreds of
// recruits. Never touches recruit_bulk_mail_jobs - this is a side-channel send, not a job.
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const testEmail = boundedText(body.test_email, 200).toLowerCase();
    const subject = boundedText(body.subject, MAX_SUBJECT_LENGTH);
    const message = boundedText(body.body, MAX_BODY_LENGTH);
    const eventAtRaw = body.event_at ? String(body.event_at) : "";

    if (!EMAIL_RE.test(testEmail)) {
        return NextResponse.json({ success: false, error: "Enter a valid email address to send the test to." }, { status: 400 });
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

    const transporter = getRecruitmentBulkMailTransporter();
    if (!transporter || !RECRUIT_BULK_MAIL_FROM) {
        return NextResponse.json({ success: false, error: "Recruitment mass-mail Gmail SMTP is not configured on this server." }, { status: 503 });
    }

    const eventLabel = formatEventLabel(eventAt);

    try {
        await sendMailWithRetry(transporter, {
            from: `"SRM Team Robocon Recruitment" <${RECRUIT_BULK_MAIL_FROM}>`,
            to: testEmail,
            subject: `[TEST] ${subject}`,
            text: message + (eventLabel ? `\n\nDate & Time: ${eventLabel}` : ""),
            html: buildBulkMailHtml({ subject, message, eventLabel }),
            attachments: [logoAttachment()],
        });
    } catch (err) {
        const reason = err instanceof Error ? err.message : "Send failed";
        return NextResponse.json({ success: false, error: `Could not send test email: ${reason}` }, { status: 502 });
    }

    return NextResponse.json({ success: true });
}
