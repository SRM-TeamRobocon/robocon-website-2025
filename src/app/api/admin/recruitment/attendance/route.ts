import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { isRecruitSubDomain, subDomainFullLabel } from "@/lib/recruit-domains";

export const dynamic = "force-dynamic";

type AttendanceType = "orientation" | "exam" | "training";

const VALID_TYPES: AttendanceType[] = ["orientation", "exam", "training"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
    // Bounded by the regex itself — a 36-char anchored match can't be abused with a
    // megabyte of free text.
    return typeof value === "string" && value.length === 36 && UUID_RE.test(value);
}

function fail(message: string, status: number) {
    return NextResponse.json({ success: false, error: message }, { status });
}

// DELETE /api/admin/recruitment/attendance
//
// Undo a mis-scan. Deliberately more privileged than scanning itself (which any
// `member` volunteer can do) — deleting attendance is destructive and unlogged from
// the recruit's side, so it is restricted to lead/admin.
//
// Body: { type: 'orientation' | 'exam' | 'training', recruit_id, sub_domain?, session_id? }
//   - sub_domain is required for type 'exam'  (attendance is keyed per exam domain)
//   - session_id is required for type 'training'
//
// Every delete is scoped to the ACTIVE cycle, so this can never reach back into a
// closed recruitment season's records.
export async function DELETE(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return fail("Only a lead or admin can undo a scan.", 403);
    }

    let body: { type?: unknown; recruit_id?: unknown; sub_domain?: unknown; session_id?: unknown };
    try {
        body = await request.json();
    } catch {
        return fail("Invalid request body.", 400);
    }

    const type = body.type as AttendanceType | undefined;
    if (!type || !VALID_TYPES.includes(type)) {
        return fail("Invalid attendance type.", 400);
    }
    if (!isUuid(body.recruit_id)) {
        return fail("A valid recruit_id is required.", 400);
    }
    const recruitId = body.recruit_id;

    if (type === "exam" && !isRecruitSubDomain(body.sub_domain)) {
        return fail("A valid exam sub_domain is required to undo exam attendance.", 400);
    }
    if (type === "training" && !isUuid(body.session_id)) {
        return fail("A valid session_id is required to undo training attendance.", 400);
    }

    const supabase = createRecruitSupabaseAdminClient();

    try {
        const { data: cycle, error: cycleError } = await supabase
            .from("recruitment_cycles")
            .select("id")
            .eq("is_active", true)
            .maybeSingle();

        if (cycleError) {
            console.error("attendance undo: cycle lookup failed", cycleError);
            return fail("Could not undo this scan.", 500);
        }
        if (!cycle) {
            return fail("No active recruitment cycle.", 503);
        }

        // Confirm the recruit belongs to the active cycle before touching anything —
        // also gives us a name for a human-readable confirmation message.
        const { data: recruit, error: recruitError } = await supabase
            .from("recruit_accounts")
            .select("id, name")
            .eq("id", recruitId)
            .eq("cycle_id", cycle.id)
            .maybeSingle();

        if (recruitError) {
            console.error("attendance undo: recruit lookup failed", recruitError);
            return fail("Could not undo this scan.", 500);
        }
        if (!recruit) {
            return fail("Recruit not found in the active cycle.", 404);
        }

        let removed = 0;
        let what = "";

        if (type === "orientation") {
            const { data, error } = await supabase
                .from("recruit_orientation_attendance")
                .delete()
                .eq("recruit_id", recruitId)
                .eq("cycle_id", cycle.id)
                .select("id");

            if (error) {
                console.error("attendance undo: orientation delete failed", error);
                return fail("Could not undo this scan.", 500);
            }
            removed = data?.length ?? 0;
            what = "orientation attendance";
        } else if (type === "exam") {
            const subDomain = body.sub_domain as string;
            const { data, error } = await supabase
                .from("recruit_exam_attendance")
                .delete()
                .eq("recruit_id", recruitId)
                .eq("cycle_id", cycle.id)
                .eq("sub_domain", subDomain)
                .select("id");

            if (error) {
                console.error("attendance undo: exam delete failed", error);
                return fail("Could not undo this scan.", 500);
            }
            removed = data?.length ?? 0;
            what = `${subDomainFullLabel(subDomain)} exam attendance`;
        } else {
            const sessionId = body.session_id as string;

            // The session must belong to the active cycle — otherwise a stale session_id
            // from another season could be used to delete rows outside this cycle.
            const { data: trainingSession, error: sessionError } = await supabase
                .from("recruit_training_sessions")
                .select("id, session_label")
                .eq("id", sessionId)
                .eq("cycle_id", cycle.id)
                .maybeSingle();

            if (sessionError) {
                console.error("attendance undo: training session lookup failed", sessionError);
                return fail("Could not undo this scan.", 500);
            }
            if (!trainingSession) {
                return fail("Training session not found in the active cycle.", 404);
            }

            const { data, error } = await supabase
                .from("recruit_training_attendance")
                .delete()
                .eq("recruit_id", recruitId)
                .eq("cycle_id", cycle.id)
                .eq("session_id", sessionId)
                .select("id");

            if (error) {
                console.error("attendance undo: training delete failed", error);
                return fail("Could not undo this scan.", 500);
            }
            removed = data?.length ?? 0;
            what = `attendance for ${trainingSession.session_label}`;
        }

        console.info(
            `[recruit-attendance-undo] ${session.user} deleted ${removed} ${type} row(s) for recruit ${recruitId} in cycle ${cycle.id}`
        );

        return NextResponse.json({
            success: true,
            removed,
            name: recruit.name,
            message:
                removed > 0
                    ? `Removed ${recruit.name}'s ${what}.`
                    : `No ${what} was recorded for ${recruit.name} — nothing to undo.`,
        });
    } catch (error) {
        console.error("Error in DELETE /api/admin/recruitment/attendance:", error);
        return fail("Could not undo this scan.", 500);
    }
}
