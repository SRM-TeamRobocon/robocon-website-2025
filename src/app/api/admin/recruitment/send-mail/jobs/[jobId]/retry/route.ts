import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

// POST /api/admin/recruitment/send-mail/jobs/:jobId/retry - resets every 'failed' recipient
// row on this job back to 'pending' (and the job back to 'sending') so the next call to
// .../process picks them up again. Doesn't touch already-'sent' rows, so a partial-failure
// retry never re-emails anyone who already got the message.
export async function POST(_request: Request, context: RouteContext) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { jobId } = await context.params;
    const supabase = createRecruitSupabaseAdminClient();

    const { data: job } = await supabase.from("recruit_bulk_mail_jobs").select("id").eq("id", jobId).maybeSingle();
    if (!job) {
        return NextResponse.json({ success: false, error: "Send job not found." }, { status: 404 });
    }

    const { data: requeued, error } = await supabase
        .from("recruit_bulk_mail_recipients")
        .update({ status: "pending", error: null })
        .eq("job_id", jobId)
        .eq("status", "failed")
        .select("id");

    if (error) {
        console.error("send-mail retry error", error);
        return NextResponse.json({ success: false, error: "Could not requeue failed recipients." }, { status: 500 });
    }

    if ((requeued ?? []).length > 0) {
        await supabase.from("recruit_bulk_mail_jobs").update({ status: "sending" }).eq("id", jobId);
    }

    return NextResponse.json({ success: true, requeued: (requeued ?? []).length });
}
