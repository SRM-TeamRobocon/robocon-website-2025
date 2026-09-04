import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { boundedText } from "@/lib/recruit-validation";
import { MAX_SUBJECT_LENGTH, MAX_BODY_LENGTH, MAX_TEMPLATE_NAME_LENGTH } from "@/lib/recruit-bulk-mail-jobs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
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
        .update({ name, subject, body: templateBody, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, name, subject, body, created_by, updated_at")
        .maybeSingle();

    if (error) {
        console.error("mail-templates update error", error);
        return NextResponse.json({ success: false, error: "Could not update template." }, { status: 500 });
    }
    if (!data) {
        return NextResponse.json({ success: false, error: "Template not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, template: data });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const supabase = createRecruitSupabaseAdminClient();
    const { error } = await supabase.from("recruit_mail_templates").delete().eq("id", id);

    if (error) {
        console.error("mail-templates delete error", error);
        return NextResponse.json({ success: false, error: "Could not delete template." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
