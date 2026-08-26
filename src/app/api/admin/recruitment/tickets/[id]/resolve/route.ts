import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { boundedText, FIELD_LIMITS } from "@/lib/recruit-validation";
import { isRecruitSubDomain, subDomainFullLabel } from "@/lib/recruit-domains";
import { getTransporter, SMTP_EMAIL, logoAttachment } from "@/lib/mailer";
import { buildTicketResolvedHtml } from "@/lib/recruit-ticket-resolved-email";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/recruitment/tickets/:id/resolve
// Marks a ticket resolved. For a category='domain_change' ticket, pass
// apply_domain_change: true to also swap the recruit's recruit_domain_selections row
// (from_sub_domain -> requested_sub_domain, or new_sub_domain to override the
// recruit's original request). Deliberately does NOT touch recruit_marks,
// recruit_shortlist_status, recruit_interview_tokens/results, or training attendance
// for the old domain — those are the historical record of what already happened under
// that domain (exam sat, interview called, etc.) and moving/deleting them would
// silently rewrite that history. A lead who needs the recruit re-evaluated under the
// new domain does that manually through the existing per-domain tooling (marks,
// shortlist, interview) rather than this route inventing rows for a process that
// hasn't happened yet.
export async function POST(request: NextRequest, context: RouteContext) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const resolutionNote = boundedText(body.resolution_note, FIELD_LIMITS.notes) || null;
    const applyDomainChange = body.apply_domain_change === true;

    const supabase = createRecruitSupabaseAdminClient();

    const { data: ticket, error: ticketError } = await supabase
        .from("recruit_tickets")
        .select("id, category, message, recruit_id, cycle_id, from_sub_domain, requested_sub_domain, status")
        .eq("id", id)
        .maybeSingle();

    if (ticketError) {
        console.error("admin tickets resolve: ticket lookup error", ticketError);
        return NextResponse.json({ error: "Could not resolve ticket" }, { status: 500 });
    }
    if (!ticket || ticket.status !== "open") {
        return NextResponse.json({ error: "Ticket not found or already resolved" }, { status: 404 });
    }

    let appliedDomainChange: { from: string; to: string } | null = null;

    if (applyDomainChange) {
        if (ticket.category !== "domain_change") {
            return NextResponse.json({ error: "Only domain_change tickets can apply a domain change." }, { status: 400 });
        }

        // Defaults to what the recruit originally asked for; a lead can override to a
        // different domain than requested (e.g. the recruit's first choice is full).
        const targetDomain =
            typeof body.new_sub_domain === "string" && body.new_sub_domain
                ? body.new_sub_domain
                : ticket.requested_sub_domain;

        if (!isRecruitSubDomain(targetDomain)) {
            return NextResponse.json({ error: "Select a valid domain to switch the recruit to." }, { status: 400 });
        }
        if (!ticket.from_sub_domain) {
            return NextResponse.json({ error: "This ticket has no source domain to switch from." }, { status: 400 });
        }
        if (targetDomain === ticket.from_sub_domain) {
            return NextResponse.json({ error: "The new domain must be different from the recruit's current one." }, { status: 400 });
        }

        const { data: existing, error: existingError } = await supabase
            .from("recruit_domain_selections")
            .select("sub_domain")
            .eq("recruit_id", ticket.recruit_id)
            .eq("cycle_id", ticket.cycle_id)
            .eq("sub_domain", targetDomain)
            .maybeSingle();
        if (existingError) {
            console.error("admin tickets resolve: existing-selection lookup error", existingError);
            return NextResponse.json({ error: "Could not resolve ticket" }, { status: 500 });
        }
        if (existing) {
            return NextResponse.json({ error: "The recruit is already registered for that domain." }, { status: 409 });
        }

        const { error: deleteError } = await supabase
            .from("recruit_domain_selections")
            .delete()
            .eq("recruit_id", ticket.recruit_id)
            .eq("cycle_id", ticket.cycle_id)
            .eq("sub_domain", ticket.from_sub_domain);
        if (deleteError) {
            console.error("admin tickets resolve: domain delete error", deleteError);
            return NextResponse.json({ error: "Could not switch the recruit's domain." }, { status: 500 });
        }

        const { error: insertError } = await supabase
            .from("recruit_domain_selections")
            .insert({ recruit_id: ticket.recruit_id, cycle_id: ticket.cycle_id, sub_domain: targetDomain });
        if (insertError) {
            console.error("admin tickets resolve: domain insert error", insertError);
            // Best-effort: put the recruit back in their original domain rather than leaving
            // them with none, since the delete above already went through.
            await supabase
                .from("recruit_domain_selections")
                .insert({ recruit_id: ticket.recruit_id, cycle_id: ticket.cycle_id, sub_domain: ticket.from_sub_domain });
            return NextResponse.json({ error: "Could not switch the recruit's domain." }, { status: 500 });
        }

        appliedDomainChange = { from: ticket.from_sub_domain, to: targetDomain };
    }

    const { data, error } = await supabase
        .from("recruit_tickets")
        .update({
            status: "resolved",
            resolution_note: resolutionNote,
            resolved_by: session.user,
            resolved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "open")
        .select("id")
        .maybeSingle();

    if (error) {
        console.error("admin tickets resolve error", error);
        return NextResponse.json({ error: "Could not resolve ticket" }, { status: 500 });
    }
    if (!data) {
        return NextResponse.json({ error: "Ticket not found or already resolved" }, { status: 404 });
    }

    // Best-effort notification, but AWAITED rather than fired-and-forgotten — a serverless
    // function's execution can be frozen the instant the response is sent, so a detached
    // promise here risks the email silently never going out. Failure still can't turn into
    // a 500 for an action that already went through (see the try/catch inside), and it's
    // skipped entirely if there's nothing to say (no resolution note) or SMTP isn't
    // configured.
    if (resolutionNote) {
        await sendTicketResolvedEmail({
            ticketId: id,
            recruitId: ticket.recruit_id,
            message: ticket.message,
            resolutionNote,
            domainChange: appliedDomainChange,
            supabase,
        });
    }

    return NextResponse.json({ success: true });
}

async function sendTicketResolvedEmail(params: {
    ticketId: string;
    recruitId: string;
    message: string;
    resolutionNote: string;
    domainChange: { from: string; to: string } | null;
    supabase: ReturnType<typeof createRecruitSupabaseAdminClient>;
}) {
    const { ticketId, recruitId, message, resolutionNote, domainChange, supabase } = params;
    try {
        const transporter = getTransporter();
        if (!transporter) return;

        const { data: recruit, error: recruitError } = await supabase
            .from("recruit_accounts")
            .select("name, srm_email, personal_email")
            .eq("id", recruitId)
            .maybeSingle();
        if (recruitError || !recruit) {
            console.error("ticket resolved email: recruit lookup failed", recruitError);
            return;
        }

        const recipients = Array.from(
            new Set(
                [recruit.srm_email, recruit.personal_email]
                    .filter((e): e is string => !!e)
                    .map((e) => e.toLowerCase())
            )
        );
        if (recipients.length === 0) return;

        const domainChangeLabels = domainChange
            ? { from: subDomainFullLabel(domainChange.from), to: subDomainFullLabel(domainChange.to) }
            : null;

        await transporter.sendMail({
            from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
            to: recipients,
            subject: "Your Ticket Has Been Resolved: SRM Team Robocon",
            text:
                `Hi ${recruit.name},\n\nYour question:\n${message}\n\nOur answer:\n${resolutionNote}` +
                (domainChangeLabels ? `\n\nDomain switched: ${domainChangeLabels.from} -> ${domainChangeLabels.to}` : ""),
            html: buildTicketResolvedHtml({ name: recruit.name, message, resolutionNote, domainChange: domainChangeLabels }),
            attachments: [logoAttachment()],
        });

        await supabase
            .from("recruit_tickets")
            .update({ resolution_email_sent_at: new Date().toISOString() })
            .eq("id", ticketId);
    } catch (err) {
        console.error("ticket resolved email: send failed", err);
    }
}
