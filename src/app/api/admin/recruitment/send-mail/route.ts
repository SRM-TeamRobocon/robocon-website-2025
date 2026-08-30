import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { selectInChunks } from "@/lib/supabase/query-helpers";
import { getSession, requireRole } from "@/lib/session";
import { getRecruitmentBulkMailTransporter, RECRUIT_BULK_MAIL_FROM, logoAttachment } from "@/lib/mailer";
import { buildBulkMailHtml } from "@/lib/recruit-bulk-mail-email";
import { boundedText } from "@/lib/recruit-validation";

export const dynamic = "force-dynamic";

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;
// Bounds a single request to roughly one active cycle's worth of recruits. Larger blasts
// should be sent as a few filtered batches rather than one request that risks a serverless
// function timeout mid-send.
const MAX_RECIPIENTS = 3000;
// A plain Gmail account caps recipients (to+cc+bcc) at ~500 per message. Recipients are
// batched into BCC-only sends of this size, sequentially — no personalization, everyone in
// a chunk gets the identical email, so this is purely a Gmail-limit workaround, not a
// per-recruit send.
const BCC_CHUNK_SIZE = 450;

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

    const recruitIds: string[] = Array.isArray(body.recruit_ids)
        ? Array.from(new Set<string>(body.recruit_ids.map((id: unknown) => String(id))))
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

    const transporter = getRecruitmentBulkMailTransporter();
    if (!transporter || !RECRUIT_BULK_MAIL_FROM) {
        return NextResponse.json({ success: false, error: "Recruitment mass-mail Gmail SMTP is not configured on this server." }, { status: 503 });
    }

    const supabase = createRecruitSupabaseAdminClient();

    const { data: cycle } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
    if (!cycle) {
        return NextResponse.json({ success: false, error: "No active recruitment cycle." }, { status: 503 });
    }

    // Scoped to the active cycle so an id list can't be reused to mail recruits from a
    // past/inactive cycle. Chunked via selectInChunks because a large selection's .in() id
    // list would otherwise blow past reverse-proxy URL-length limits (see query-helpers.ts).
    const { data: recruits, error: recruitsError } = await selectInChunks<{
        id: string;
        name: string;
        srm_email: string | null;
        personal_email: string | null;
    }>(recruitIds, (chunk) =>
        supabase
            .from("recruit_accounts")
            .select("id, name, srm_email, personal_email")
            .eq("cycle_id", cycle.id)
            .in("id", chunk)
    );

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

    // Everyone selected goes into one shared BCC blast (no personalization) — split only to
    // stay under Gmail's per-message recipient cap, never per recruit.
    const emailToRecruitIds = new Map<string, Set<string>>();
    for (const r of recruits as { id: string; name: string; srm_email: string | null; personal_email: string | null }[]) {
        const emails = Array.from(
            new Set([r.srm_email, r.personal_email].filter((e): e is string => !!e).map((e) => e.toLowerCase()))
        );
        if (emails.length === 0) {
            failures.push({ recruit_id: r.id, name: r.name, error: "No email on file" });
            continue;
        }
        for (const email of emails) {
            if (!emailToRecruitIds.has(email)) emailToRecruitIds.set(email, new Set());
            emailToRecruitIds.get(email)!.add(r.id);
        }
    }

    const recruitById = new Map(recruits.map((r: { id: string; name: string }) => [r.id, r.name]));
    const allEmails = Array.from(emailToRecruitIds.keys());
    const sentRecruitIds = new Set<string>();
    const errorByRecruitId = new Map<string, string>();

    for (let i = 0; i < allEmails.length; i += BCC_CHUNK_SIZE) {
        const chunk = allEmails.slice(i, i + BCC_CHUNK_SIZE);
        try {
            await transporter.sendMail({
                from: `"SRM Team Robocon Recruitment" <${RECRUIT_BULK_MAIL_FROM}>`,
                to: RECRUIT_BULK_MAIL_FROM,
                bcc: chunk,
                subject,
                text: message + (eventLabel ? `\n\nDate & Time: ${eventLabel}` : ""),
                html: buildBulkMailHtml({ subject, message, eventLabel }),
                attachments: [logoAttachment()],
            });
            chunk.forEach((email) => {
                emailToRecruitIds.get(email)!.forEach((id) => sentRecruitIds.add(id));
            });
        } catch (err) {
            const reason = err instanceof Error ? err.message : "Send failed";
            chunk.forEach((email) => {
                emailToRecruitIds.get(email)!.forEach((id) => errorByRecruitId.set(id, reason));
            });
        }
    }

    errorByRecruitId.forEach((error, id) => {
        if (!sentRecruitIds.has(id)) {
            failures.push({ recruit_id: id, name: recruitById.get(id) || id, error });
        }
    });

    const sent = sentRecruitIds.size;
    return NextResponse.json({ success: true, sent, failed: failures.length, failures });
}
