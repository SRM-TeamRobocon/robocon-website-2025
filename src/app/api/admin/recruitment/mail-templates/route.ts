import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { boundedText } from "@/lib/recruit-validation";
import { MAX_SUBJECT_LENGTH, MAX_BODY_LENGTH, MAX_TEMPLATE_NAME_LENGTH } from "@/lib/recruit-bulk-mail-jobs";

export const dynamic = "force-dynamic";

// Saved subject/body presets for the Send Mail composer. Global across cycles (see
// recruit-migration-025-bulk-mail-jobs.sql) - not filtered by recruitment_cycles.id.

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createRecruitSupabaseAdminClient();
    const { data, error } = await supabase
        .from("recruit_mail_templates")
        .select("id, name, subject, body, created_by, updated_at")
        .order("name", { ascending: true });

    if (error) {
        console.error("mail-templates list error", error);
        return NextResponse.json({ success: false, error: "Could not load templates." }, { status: 500 });
    }

    return NextResponse.json({ success: true, templates: data ?? [] });
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const name = boundedText(body.name, MAX_TEMPLATE_NAME_LENGTH);
    const subject = boundedText(body.subject, MAX_SUBJECT_LENGTH);
    const templateBody = boundedText(body.body, MAX_BODY_LENGTH);

    if (!name || !subject || !templateBody) {
        return NextResponse.json({ success: false, error: "Name, subject and message are all required." }, { status: 400 });
    }

    const supabase = createRecruitSupabaseAdminClient();
    const { data, error } = await supabase
        .from("recruit_mail_templates")
        .insert({ name, subject, body: templateBody, created_by: session.user })
        .select("id, name, subject, body, created_by, updated_at")
        .single();

    if (error) {
        console.error("mail-templates create error", error);
        return NextResponse.json({ success: false, error: "Could not save template." }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data });
}
