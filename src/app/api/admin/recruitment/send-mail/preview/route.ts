import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { boundedText } from "@/lib/recruit-validation";
import { buildBulkMailHtml } from "@/lib/recruit-bulk-mail-email";
import { MAX_SUBJECT_LENGTH, MAX_BODY_LENGTH, formatEventLabel } from "@/lib/recruit-bulk-mail-jobs";

export const dynamic = "force-dynamic";

// POST /api/admin/recruitment/send-mail/preview - renders the same HTML the real send would
// produce, without touching the database or sending anything, so the composer can check
// formatting before blasting it at hundreds of recruits.
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const subject = boundedText(body.subject, MAX_SUBJECT_LENGTH) || "(no subject)";
    const message = boundedText(body.body, MAX_BODY_LENGTH) || "(no message)";
    const eventAtRaw = body.event_at ? String(body.event_at) : "";

    let eventAt: Date | null = null;
    if (eventAtRaw) {
        const parsed = new Date(eventAtRaw);
        if (!Number.isNaN(parsed.getTime())) eventAt = parsed;
    }

    const html = buildBulkMailHtml({ subject, message, eventLabel: formatEventLabel(eventAt) });
    return NextResponse.json({ success: true, html });
}
