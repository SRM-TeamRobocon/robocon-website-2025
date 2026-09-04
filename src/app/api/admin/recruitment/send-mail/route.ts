import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { selectInChunks } from "@/lib/supabase/query-helpers";
import { getSession, requireRole } from "@/lib/session";
import { boundedText } from "@/lib/recruit-validation";
import { MAX_SUBJECT_LENGTH, MAX_BODY_LENGTH, MAX_RECIPIENTS } from "@/lib/recruit-bulk-mail-jobs";

export const dynamic = "force-dynamic";

// POST /api/admin/recruitment/send-mail - creates a recruit_bulk_mail_jobs row (plus one
// recruit_bulk_mail_recipients row per deduped BCC address) for an admin-composed
// subject/body and an optional date & time, scoped to selected recruits in the active
// cycle. Does NOT send anything itself - the actual sending happens as the client repeatedly
// calls POST .../jobs/[jobId]/process, one BCC-chunk per call, so a single request can never
// block on the whole batch (see recruit-migration-025-bulk-mail-jobs.sql for why).
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
        srm_email: string | null;
        personal_email: string | null;
    }>(recruitIds, (chunk) =>
        supabase
            .from("recruit_accounts")
            .select("id, srm_email, personal_email")
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

    // Everyone selected goes into one shared BCC blast (no personalization) - dedupe by
    // email so a recruit whose srm_email == personal_email, or two recruits sharing an
    // address, doesn't get double-counted as two recipient rows.
    const emailToRecruitIds = new Map<string, Set<string>>();
    for (const r of recruits) {
        const emails = Array.from(
            new Set([r.srm_email, r.personal_email].filter((e): e is string => !!e).map((e) => e.toLowerCase()))
        );
        for (const email of emails) {
            if (!emailToRecruitIds.has(email)) emailToRecruitIds.set(email, new Set());
            emailToRecruitIds.get(email)!.add(r.id);
        }
    }

    const recruitsWithNoEmail = recruits.filter(
        (r) => !r.srm_email && !r.personal_email
    ).length;

    if (emailToRecruitIds.size === 0) {
        return NextResponse.json(
            { success: false, error: "None of the selected recruits have an email on file." },
            { status: 400 }
        );
    }

    const { data: job, error: jobError } = await supabase
        .from("recruit_bulk_mail_jobs")
        .insert({
            cycle_id: cycle.id,
            subject,
            body: message,
            event_at: eventAt ? eventAt.toISOString() : null,
            total_recruits: recruits.length,
            created_by: session.user,
        })
        .select("id")
        .single();

    if (jobError || !job) {
        console.error("send-mail job insert error", jobError);
        return NextResponse.json({ success: false, error: "Could not create the send job." }, { status: 500 });
    }

    const recipientRows = Array.from(emailToRecruitIds.entries()).map(([email, ids]) => ({
        job_id: job.id,
        email,
        recruit_ids: Array.from(ids),
    }));

    const { error: recipientsError } = await supabase.from("recruit_bulk_mail_recipients").insert(recipientRows);
    if (recipientsError) {
        console.error("send-mail recipients insert error", recipientsError);
        // Best-effort cleanup so a half-created job doesn't linger in the "Recent Sends" list.
        await supabase.from("recruit_bulk_mail_jobs").delete().eq("id", job.id);
        return NextResponse.json({ success: false, error: "Could not queue recipients for this job." }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        job_id: job.id,
        total_recruits: recruits.length,
        recruits_with_no_email: recruitsWithNoEmail,
    });
}
