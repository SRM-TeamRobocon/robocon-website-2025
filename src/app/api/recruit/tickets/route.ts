import { NextRequest, NextResponse } from "next/server";
import { getRecruitSession } from "@/lib/recruit-session";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { boundedText, FIELD_LIMITS } from "@/lib/recruit-validation";

export const dynamic = "force-dynamic";

const TICKET_COLUMNS =
    "id, category, message, current_sub_domains, from_sub_domain, requested_sub_domain, status, resolution_note, resolved_at, created_at";

// GET /api/recruit/tickets - the recruit's own ticket history, newest first. Also used
// by the dashboard to decide whether the "raise a ticket" form should be shown (an open
// ticket blocks a new one - see the partial unique index in
// recruit-migration-009-tickets.sql).
export async function GET() {
    const session = await getRecruitSession();
    if (!session) {
        return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createRecruitSupabaseAdminClient();
    const { data, error } = await supabase
        .from("recruit_tickets")
        .select(TICKET_COLUMNS)
        .eq("recruit_id", session.recruit_id)
        .eq("cycle_id", session.cycle_id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("recruit tickets GET error", error);
        return NextResponse.json({ success: false, error: "Could not load tickets" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
}

// POST /api/recruit/tickets - raise a new ticket. Body:
//   { category: "general", message }
//   { category: "domain_change", message, from_sub_domain, requested_sub_domain }
export async function POST(request: NextRequest) {
    const session = await getRecruitSession();
    if (!session) {
        return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const category = body.category === "domain_change" ? "domain_change" : body.category === "general" ? "general" : "";
    if (!category) {
        return NextResponse.json({ success: false, error: "category must be 'domain_change' or 'general'" }, { status: 400 });
    }

    const message = boundedText(body.message, FIELD_LIMITS.notes);
    if (!message) {
        return NextResponse.json({ success: false, error: "Please describe your request." }, { status: 400 });
    }

    const supabase = createRecruitSupabaseAdminClient();

    const { data: selections, error: selectionsError } = await supabase
        .from("recruit_domain_selections")
        .select("sub_domain")
        .eq("recruit_id", session.recruit_id)
        .eq("cycle_id", session.cycle_id);

    if (selectionsError) {
        console.error("recruit tickets POST: selections lookup error", selectionsError);
        return NextResponse.json({ success: false, error: "Could not load your domains" }, { status: 500 });
    }

    const currentSubDomains = (selections ?? []).map((s) => s.sub_domain as string);

    let fromSubDomain: string | null = null;
    let requestedSubDomain: string | null = null;
    if (category === "domain_change") {
        fromSubDomain = typeof body.from_sub_domain === "string" ? body.from_sub_domain : "";
        requestedSubDomain = typeof body.requested_sub_domain === "string" ? body.requested_sub_domain : "";

        if (!isRecruitSubDomain(fromSubDomain)) {
            return NextResponse.json({ success: false, error: "Select which domain you're switching from." }, { status: 400 });
        }
        if (!currentSubDomains.includes(fromSubDomain)) {
            return NextResponse.json(
                { success: false, error: "You're not currently registered for that domain." },
                { status: 400 }
            );
        }
        if (!isRecruitSubDomain(requestedSubDomain)) {
            return NextResponse.json({ success: false, error: "Select a valid domain to switch to." }, { status: 400 });
        }
        if (requestedSubDomain === fromSubDomain) {
            return NextResponse.json(
                { success: false, error: "The 'to' domain must be different from the 'from' domain." },
                { status: 400 }
            );
        }
        if (currentSubDomains.includes(requestedSubDomain)) {
            return NextResponse.json(
                { success: false, error: "You're already registered for that domain." },
                { status: 400 }
            );
        }
    }

    const { data, error } = await supabase
        .from("recruit_tickets")
        .insert({
            cycle_id: session.cycle_id,
            recruit_id: session.recruit_id,
            category,
            message,
            current_sub_domains: currentSubDomains,
            from_sub_domain: fromSubDomain,
            requested_sub_domain: requestedSubDomain,
        })
        .select(TICKET_COLUMNS)
        .single();

    if (error) {
        // Postgres unique_violation - the partial unique index on (recruit_id) where
        // status='open' means this recruit already has an open ticket.
        if (error.code === "23505") {
            return NextResponse.json(
                { success: false, error: "You already have an open ticket. Wait for it to be resolved before raising a new one." },
                { status: 409 }
            );
        }
        console.error("recruit tickets POST error", error);
        return NextResponse.json({ success: false, error: "Could not submit your ticket" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
}
