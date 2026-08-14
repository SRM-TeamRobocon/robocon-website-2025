import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { boundedText, FIELD_LIMITS } from "@/lib/recruit-validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/recruitment/tickets/:id/resolve
// Marks a ticket resolved. Deliberately does NOT touch recruit_domain_selections even
// for a category='domain_change' ticket — see the comment in
// supabase/recruit-migration-009-tickets.sql. A lead reads the ticket, updates the
// recruit's actual domain (and any dependent marks/shortlist/interview rows) through
// existing admin tooling by hand, then resolves the ticket here as a record of that.
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

    const supabase = createRecruitSupabaseAdminClient();
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

    return NextResponse.json({ success: true });
}
