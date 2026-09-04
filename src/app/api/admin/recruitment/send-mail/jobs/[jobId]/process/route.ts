import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { getRecruitmentBulkMailTransporter, RECRUIT_BULK_MAIL_FROM, logoAttachment, sendMailWithRetry } from "@/lib/mailer";
import { buildBulkMailHtml } from "@/lib/recruit-bulk-mail-email";
import { BCC_CHUNK_SIZE, formatEventLabel, getJobProgress } from "@/lib/recruit-bulk-mail-jobs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

interface RecipientRow {
    id: string;
    email: string;
    recruit_ids: string[];
    attempts: number;
}

// POST /api/admin/recruitment/send-mail/jobs/:jobId/process - sends ONE BCC chunk (up to
// BCC_CHUNK_SIZE addresses still pending) for this job and persists the result before
// returning. The client (send-mail/page.tsx) calls this repeatedly in a loop until
// `done: true`, so a page reload or a slow/failed individual call never loses track of what
// was already sent - the next call just picks up wherever recruit_bulk_mail_recipients says
// sending left off.
export async function POST(_request: Request, context: RouteContext) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { jobId } = await context.params;
    const supabase = createRecruitSupabaseAdminClient();

    const { data: job, error: jobError } = await supabase
        .from("recruit_bulk_mail_jobs")
        .select("id, subject, body, event_at, status")
        .eq("id", jobId)
        .maybeSingle();

    if (jobError) {
        console.error("send-mail process: job lookup error", jobError);
        return NextResponse.json({ success: false, error: "Could not load this send job." }, { status: 500 });
    }
    if (!job) {
        return NextResponse.json({ success: false, error: "Send job not found." }, { status: 404 });
    }

    const { data: chunk, error: chunkError } = await supabase
        .from("recruit_bulk_mail_recipients")
        .select("id, email, recruit_ids, attempts")
        .eq("job_id", jobId)
        .eq("status", "pending")
        .order("email", { ascending: true })
        .limit(BCC_CHUNK_SIZE);

    if (chunkError) {
        console.error("send-mail process: chunk lookup error", chunkError);
        return NextResponse.json({ success: false, error: "Could not load the next batch to send." }, { status: 500 });
    }

    const pending = (chunk ?? []) as RecipientRow[];

    if (pending.length === 0) {
        if (job.status !== "done") {
            await supabase.from("recruit_bulk_mail_jobs").update({ status: "done" }).eq("id", jobId);
        }
        const progress = await getJobProgress(supabase, jobId);
        return NextResponse.json({ success: true, done: true, progress });
    }

    if (job.status === "pending") {
        await supabase.from("recruit_bulk_mail_jobs").update({ status: "sending" }).eq("id", jobId);
    }

    const transporter = getRecruitmentBulkMailTransporter();
    if (!transporter || !RECRUIT_BULK_MAIL_FROM) {
        return NextResponse.json(
            { success: false, error: "Recruitment mass-mail Gmail SMTP is not configured on this server." },
            { status: 503 }
        );
    }

    const eventAt = job.event_at ? new Date(job.event_at as string) : null;
    const eventLabel = formatEventLabel(eventAt);
    const emails = pending.map((r) => r.email);

    let rejected = new Set<string>();
    let sendError: string | null = null;

    try {
        const info = await sendMailWithRetry(transporter, {
            from: `"SRM Team Robocon Recruitment" <${RECRUIT_BULK_MAIL_FROM}>`,
            to: RECRUIT_BULK_MAIL_FROM,
            bcc: emails,
            subject: job.subject as string,
            text: (job.body as string) + (eventLabel ? `\n\nDate & Time: ${eventLabel}` : ""),
            html: buildBulkMailHtml({ subject: job.subject as string, message: job.body as string, eventLabel }),
            attachments: [logoAttachment()],
        });
        // A non-throwing send can still partially reject individual addresses (invalid
        // mailbox etc.) - those come back in `rejected`, distinct from the whole chunk
        // throwing on a connection-level failure below.
        rejected = new Set((info?.rejected ?? []).map((r) => (typeof r === "string" ? r.toLowerCase() : "")));
    } catch (err) {
        sendError = err instanceof Error ? err.message : "Send failed";
    }

    const now = new Date().toISOString();
    const updates = pending.map((row) => {
        const failed = sendError !== null || rejected.has(row.email.toLowerCase());
        return {
            id: row.id,
            job_id: jobId,
            email: row.email,
            recruit_ids: row.recruit_ids,
            status: failed ? "failed" : "sent",
            error: failed ? (sendError ?? "Rejected by mail server") : null,
            attempts: row.attempts + 1,
            updated_at: now,
        };
    });

    const { error: updateError } = await supabase.from("recruit_bulk_mail_recipients").upsert(updates, { onConflict: "id" });
    if (updateError) {
        console.error("send-mail process: recipient update error", updateError);
        return NextResponse.json({ success: false, error: "Sent, but could not record the result." }, { status: 500 });
    }

    const progress = await getJobProgress(supabase, jobId);
    const stillPending = progress.pending > 0;
    if (!stillPending && job.status !== "done") {
        await supabase.from("recruit_bulk_mail_jobs").update({ status: "done" }).eq("id", jobId);
    }

    return NextResponse.json({ success: true, done: !stillPending, progress });
}
