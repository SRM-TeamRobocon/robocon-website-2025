// One-off backfill for tickets that were resolved before the auto-email-on-resolve
// feature existed (src/app/api/admin/recruitment/tickets/[id]/resolve/route.ts). Going
// forward, every new resolve sends its own email and stamps resolution_email_sent_at —
// this script only ever touches rows where that column is still null, so re-running it
// after a partial failure can't double-email anyone.
//
// Usage:
//   npx tsx scripts/backfill-ticket-resolution-emails.ts --sample=someone@example.com
//     Sends ONE real ticket's email to the given address only, as a preview. Does not
//     touch the database (resolution_email_sent_at is left untouched) and does not email
//     any recruit.
//
//   npx tsx scripts/backfill-ticket-resolution-emails.ts --send-all
//     Sends the real backfill to every qualifying resolved ticket's recruit (both
//     srm_email and personal_email, deduped) and stamps resolution_email_sent_at on
//     success. This is the one that actually reaches recruits — only run it after
//     reviewing a --sample.
//
// Not using createRecruitSupabaseAdminClient()/getRecruitSession() imports here on
// purpose — those modules pull in "server-only", which throws when imported outside a
// Next.js server bundle (i.e. under plain tsx), so this constructs its own client instead.
//
// src/lib/mailer.ts also can't be a plain top-level `import` here: it captures
// SMTP_EMAIL/SMTP_PASSWORD as eager module-level consts read from process.env at import
// time, and ES module imports are hoisted above all other code in the file regardless of
// source order — so a static import would run before loadEnvConfig() below ever populates
// process.env, and getTransporter() would always see them as unset. Loaded via a dynamic
// import() inside run() instead, after loadEnvConfig() has actually run (this is exactly
// how Next.js itself avoids the issue: it loads .env.local long before any app code that
// might import mailer.ts).

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";
import { buildTicketResolvedHtml } from "../src/lib/recruit-ticket-resolved-email";

const SEND_CONCURRENCY = 5;

type TicketRow = {
    id: string;
    message: string;
    resolution_note: string | null;
    recruit_id: string;
    category: string;
};

type RecruitRow = {
    id: string;
    name: string;
    srm_email: string | null;
    personal_email: string | null;
};

function supabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function fetchQualifyingTickets(db: ReturnType<typeof supabase>): Promise<TicketRow[]> {
    const { data, error } = await db
        .from("recruit_tickets")
        .select("id, message, resolution_note, recruit_id, category")
        .eq("status", "resolved")
        .is("resolution_email_sent_at", null)
        .not("resolution_note", "is", null)
        .order("resolved_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as TicketRow[];
}

async function fetchRecruit(db: ReturnType<typeof supabase>, recruitId: string): Promise<RecruitRow | null> {
    const { data, error } = await db
        .from("recruit_accounts")
        .select("id, name, srm_email, personal_email")
        .eq("id", recruitId)
        .maybeSingle();
    if (error) throw error;
    return data as RecruitRow | null;
}

async function run() {
    const sampleArg = process.argv.find((a) => a.startsWith("--sample="));
    const sendAll = process.argv.includes("--send-all");

    if (!sampleArg && !sendAll) {
        console.log("Pass --sample=<email> to preview one, or --send-all to backfill everyone.");
        process.exit(1);
    }

    const { getTransporter, SMTP_EMAIL, logoAttachment } = await import("../src/lib/mailer");
    const transporter = getTransporter();
    if (!transporter) {
        console.error("SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD / SMTP_FROM) — aborting.");
        process.exit(1);
    }

    const db = supabase();
    const tickets = await fetchQualifyingTickets(db);
    console.log(`Found ${tickets.length} resolved ticket(s) with no resolution email sent yet.`);

    if (tickets.length === 0) return;

    if (sampleArg) {
        const sampleEmail = sampleArg.slice("--sample=".length);
        // Most substantive resolution note first — makes for a more representative preview
        // than whichever row happens to sort first.
        const pick = [...tickets].sort(
            (a, b) => (b.resolution_note?.length ?? 0) - (a.resolution_note?.length ?? 0)
        )[0];
        const recruit = await fetchRecruit(db, pick.recruit_id);
        if (!recruit) {
            console.error("Could not load the recruit for the sample ticket.");
            process.exit(1);
        }

        console.log(`Sending sample (ticket ${pick.id}, recruit ${recruit.name}) to ${sampleEmail}...`);
        await transporter.sendMail({
            from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
            to: sampleEmail,
            subject: "[SAMPLE] Your Ticket Has Been Resolved — SRM Team Robocon",
            text: `Hi ${recruit.name},\n\nYour question:\n${pick.message}\n\nOur answer:\n${pick.resolution_note}`,
            html: buildTicketResolvedHtml({
                name: recruit.name,
                message: pick.message,
                resolutionNote: pick.resolution_note as string,
                domainChange: null,
            }),
            attachments: [logoAttachment()],
        });
        console.log("Sample sent. Nothing was written to the database, no recruit was emailed.");
        return;
    }

    // --send-all
    let sent = 0;
    const failures: { ticket_id: string; error: string }[] = [];

    for (let i = 0; i < tickets.length; i += SEND_CONCURRENCY) {
        const batch = tickets.slice(i, i + SEND_CONCURRENCY);
        const results = await Promise.allSettled(
            batch.map(async (ticket) => {
                const recruit = await fetchRecruit(db, ticket.recruit_id);
                if (!recruit) throw new Error("recruit not found");

                const recipients = Array.from(
                    new Set(
                        [recruit.srm_email, recruit.personal_email]
                            .filter((e): e is string => !!e)
                            .map((e) => e.toLowerCase())
                    )
                );
                if (recipients.length === 0) throw new Error("no email on file");

                await transporter.sendMail({
                    from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
                    to: recipients,
                    subject: "Your Ticket Has Been Resolved — SRM Team Robocon",
                    text: `Hi ${recruit.name},\n\nYour question:\n${ticket.message}\n\nOur answer:\n${ticket.resolution_note}`,
                    html: buildTicketResolvedHtml({
                        name: recruit.name,
                        message: ticket.message,
                        resolutionNote: ticket.resolution_note as string,
                        domainChange: null,
                    }),
                    attachments: [logoAttachment()],
                });

                const { error: updateError } = await db
                    .from("recruit_tickets")
                    .update({ resolution_email_sent_at: new Date().toISOString() })
                    .eq("id", ticket.id);
                if (updateError) throw updateError;
            })
        );

        results.forEach((result, idx) => {
            if (result.status === "fulfilled") {
                sent += 1;
            } else {
                const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
                failures.push({ ticket_id: batch[idx].id, error: reason });
            }
        });
    }

    console.log(`Sent ${sent}/${tickets.length}.`);
    if (failures.length > 0) {
        console.log("Failures:");
        failures.forEach((f) => console.log(`  ${f.ticket_id}: ${f.error}`));
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
