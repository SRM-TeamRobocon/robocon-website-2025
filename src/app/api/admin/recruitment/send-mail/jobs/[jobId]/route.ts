import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { getJobProgress } from "@/lib/recruit-bulk-mail-jobs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

// GET /api/admin/recruitment/send-mail/jobs/:jobId - job detail plus the failed recipient
// rows (with recruit names resolved) for the "view failures" / "retry failed" panel. Sent
// and pending rows aren't returned here - the aggregate counts from getJobProgress cover
// those, and only failures are ever actionable from this view.
export async function GET(_request: Request, context: RouteContext) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { jobId } = await context.params;

    const supabase = createRecruitSupabaseAdminClient();

    const { data: job, error: jobError } = await supabase
        .from("recruit_bulk_mail_jobs")
        .select("id, subject, body, event_at, status, total_recruits, created_by, created_at")
        .eq("id", jobId)
        .maybeSingle();

    if (jobError) {
        console.error("send-mail job detail error", jobError);
        return NextResponse.json({ success: false, error: "Could not load this send." }, { status: 500 });
    }
    if (!job) {
        return NextResponse.json({ success: false, error: "Send job not found." }, { status: 404 });
    }

    const { data: failedRows, error: failedError } = await supabase
        .from("recruit_bulk_mail_recipients")
        .select("email, recruit_ids, error")
        .eq("job_id", jobId)
        .eq("status", "failed");

    if (failedError) {
        console.error("send-mail job failures lookup error", failedError);
        return NextResponse.json({ success: false, error: "Could not load failures for this send." }, { status: 500 });
    }

    const allRecruitIds = Array.from(
        new Set((failedRows ?? []).flatMap((r) => r.recruit_ids as string[]))
    );

    const namesById = new Map<string, string>();
    if (allRecruitIds.length > 0) {
        const { data: recruitRows } = await supabase
            .from("recruit_accounts")
            .select("id, name")
            .in("id", allRecruitIds);
        (recruitRows ?? []).forEach((r: { id: string; name: string }) => namesById.set(r.id, r.name));
    }

    const failures = (failedRows ?? []).map((r) => ({
        email: r.email as string,
        error: r.error as string | null,
        recruits: (r.recruit_ids as string[]).map((id) => ({ id, name: namesById.get(id) || id })),
    }));

    const progress = await getJobProgress(supabase, jobId);

    return NextResponse.json({ success: true, job, progress, failures });
}
