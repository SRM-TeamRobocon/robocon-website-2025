import { NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { getJobProgress } from "@/lib/recruit-bulk-mail-jobs";

export const dynamic = "force-dynamic";

// Recent-first, capped small - this feeds the "Recent Sends" audit panel on the Send Mail
// page, not a full searchable history. getJobProgress does one extra query per job, so this
// is intentionally not the full job list for the cycle.
const RECENT_JOBS_LIMIT = 20;

// GET /api/admin/recruitment/send-mail/jobs - recent bulk-mail jobs for the active cycle,
// each with live sent/failed/pending counts, for the "Recent Sends" audit trail.
export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createRecruitSupabaseAdminClient();

    const { data: cycle } = await supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle();
    if (!cycle) {
        return NextResponse.json({ success: true, jobs: [] });
    }

    const { data: jobs, error } = await supabase
        .from("recruit_bulk_mail_jobs")
        .select("id, subject, body, event_at, status, total_recruits, created_by, created_at")
        .eq("cycle_id", cycle.id)
        .order("created_at", { ascending: false })
        .limit(RECENT_JOBS_LIMIT);

    if (error) {
        console.error("send-mail jobs list error", error);
        return NextResponse.json({ success: false, error: "Could not load recent sends." }, { status: 500 });
    }

    const withProgress = await Promise.all(
        (jobs ?? []).map(async (job) => ({ ...job, progress: await getJobProgress(supabase, job.id) }))
    );

    return NextResponse.json({ success: true, jobs: withProgress });
}
