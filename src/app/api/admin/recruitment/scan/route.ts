import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { verifyQR } from "@/lib/recruit-qr";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { isRecruitSubDomain, subDomainFullLabel } from "@/lib/recruit-domains";
import { todayInIST } from "@/lib/recruit-dates";

export const dynamic = "force-dynamic";

type ScanMode = "orientation" | "exam_day_1" | "exam_day_2" | "interview" | "training";

const VALID_MODES: ScanMode[] = ["orientation", "exam_day_1", "exam_day_2", "interview", "training"];

// Postgres unique_violation error code.
const UNIQUE_VIOLATION = "23505";

function scanResponse(
    status: "ok" | "already_scanned" | "already_checked_in" | "error",
    name: string,
    message: string,
    extra?: { token_number?: number; panel_label?: string; session_id?: string },
    httpStatus = 200
) {
    return NextResponse.json({ status, name, message, ...extra }, { status: httpStatus });
}

// POST /api/admin/recruitment/scan
// Requires admin_token (any of member/lead/admin — all volunteers have at least member).
// Body: { payload, mode, panel_id?, sub_domain? } — see 05-QR-AND-SCANNING.md.
// Training mode takes a sub_domain (not a session_id): the day's session row is created
// on demand by the first scan, so no lead has to set one up in advance.
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ status: "error", name: "", message: "Forbidden" }, { status: 403 });
    }

    let body: { payload?: string; mode?: string; panel_id?: string; sub_domain?: string };
    try {
        body = await request.json();
    } catch {
        return scanResponse("error", "", "Invalid request body", undefined, 400);
    }

    const { payload, panel_id, sub_domain } = body;
    const mode = body.mode as ScanMode | undefined;

    if (!payload || typeof payload !== "string") {
        return scanResponse("error", "", "Missing QR payload", undefined, 400);
    }
    if (!mode || !VALID_MODES.includes(mode)) {
        return scanResponse("error", "", "Invalid or missing scan mode", undefined, 400);
    }

    const verified = verifyQR(payload);
    if (!verified) {
        return scanResponse("error", "", "Invalid QR", undefined, 400);
    }
    const { rid, cid } = verified;

    const supabase = createRecruitSupabaseAdminClient();

    // Recruit lookup and active-cycle lookup are independent reads — running them in
    // parallel instead of sequentially cuts one full network round trip off every single
    // scan, which matters a lot when a volunteer is scanning a queue of people back to back.
    const [{ data: recruit, error: recruitError }, { data: activeCycle }] = await Promise.all([
        supabase.from("recruit_accounts").select("id, name, is_selected").eq("id", rid).maybeSingle(),
        supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle(),
    ]);

    if (recruitError) {
        console.error("Error looking up recruit_accounts:", recruitError);
        return scanResponse("error", "", "Internal server error", undefined, 500);
    }
    if (!recruit) {
        return scanResponse("error", "", "Recruit not found", undefined, 404);
    }

    // Confirm the QR's cycle matches the currently active cycle.
    if (!activeCycle) {
        return scanResponse("error", recruit.name, "No active recruitment cycle", undefined, 503);
    }
    if (cid !== activeCycle.id) {
        return scanResponse("error", recruit.name, "QR is from a different cycle", undefined, 400);
    }

    const scannedBy = session.user;

    try {
        switch (mode) {
            case "orientation": {
                // Insert directly rather than checking-then-inserting: the overwhelming
                // majority of scans are first-time, so paying for a pre-check select on
                // every scan just to save one on the rare repeat-scan case is a net loss.
                // The unique (recruit_id, cycle_id) constraint is the actual arbiter either way.
                const { error: insertError } = await supabase.from("recruit_orientation_attendance").insert({
                    cycle_id: cid,
                    recruit_id: rid,
                    scanned_by: scannedBy,
                });

                if (insertError) {
                    if (insertError.code === UNIQUE_VIOLATION) {
                        return scanResponse("already_scanned", recruit.name, `${recruit.name} already scanned for orientation`);
                    }
                    throw insertError;
                }

                return scanResponse("ok", recruit.name, "Orientation marked");
            }

            case "exam_day_1":
            case "exam_day_2": {
                const day = mode === "exam_day_1" ? 1 : 2;

                // Exam attendance is per sub-domain: a recruit sitting two different
                // domain exams gets one row per exam. The volunteer picks which exam
                // they're scanning for before scanning.
                if (!isRecruitSubDomain(sub_domain)) {
                    return scanResponse(
                        "error",
                        recruit.name,
                        "Select which exam domain you are scanning for",
                        undefined,
                        400
                    );
                }

                const domainLabel = subDomainFullLabel(sub_domain);

                // The eligibility check (did they apply to this domain?) and the
                // already-scanned check are independent reads — run them together instead
                // of one-after-another. Only mark attendance for an exam the recruit
                // actually applied to, otherwise a mis-set scanner mode silently creates
                // bogus attendance.
                const [{ data: selection }, { data: existing }] = await Promise.all([
                    supabase
                        .from("recruit_domain_selections")
                        .select("id")
                        .eq("recruit_id", rid)
                        .eq("cycle_id", cid)
                        .eq("sub_domain", sub_domain)
                        .maybeSingle(),
                    supabase
                        .from("recruit_exam_attendance")
                        .select("id, day")
                        .eq("recruit_id", rid)
                        .eq("cycle_id", cid)
                        .eq("sub_domain", sub_domain)
                        .maybeSingle(),
                ]);

                if (!selection) {
                    return scanResponse(
                        "error",
                        recruit.name,
                        `${recruit.name} did not apply for ${domainLabel}`,
                        undefined,
                        400
                    );
                }

                if (existing) {
                    return scanResponse(
                        "already_scanned",
                        recruit.name,
                        `${recruit.name} already scanned for the ${domainLabel} exam (Day ${existing.day})`
                    );
                }

                const { error: insertError } = await supabase.from("recruit_exam_attendance").insert({
                    cycle_id: cid,
                    recruit_id: rid,
                    sub_domain,
                    day,
                    scanned_by: scannedBy,
                });

                if (insertError) {
                    if (insertError.code === UNIQUE_VIOLATION) {
                        return scanResponse(
                            "already_scanned",
                            recruit.name,
                            `${recruit.name} already scanned for the ${domainLabel} exam`
                        );
                    }
                    throw insertError;
                }

                return scanResponse("ok", recruit.name, `${domainLabel} exam — Day ${day} attendance marked`);
            }

            case "interview": {
                if (!panel_id) {
                    return scanResponse("error", recruit.name, "panel_id is required for interview mode", undefined, 400);
                }

                const { data: panel } = await supabase
                    .from("recruit_interview_panels")
                    .select("id, domain_label, is_active, cycle_id")
                    .eq("id", panel_id)
                    .maybeSingle();

                if (!panel || panel.cycle_id !== cid) {
                    return scanResponse("error", recruit.name, "Panel not found for the active cycle", undefined, 404);
                }
                if (!panel.is_active) {
                    return scanResponse("error", recruit.name, "This panel is closed", undefined, 400);
                }

                const { data: existingToken } = await supabase
                    .from("recruit_interview_tokens")
                    .select("token_number")
                    .eq("recruit_id", rid)
                    .eq("panel_id", panel_id)
                    .maybeSingle();

                if (existingToken) {
                    return scanResponse(
                        "already_checked_in",
                        recruit.name,
                        `${recruit.name} already checked in for ${panel.domain_label}`,
                        { token_number: existingToken.token_number, panel_label: panel.domain_label }
                    );
                }

                const { data: shortlisted } = await supabase
                    .from("recruit_shortlist_status")
                    .select("id")
                    .eq("recruit_id", rid)
                    .eq("cycle_id", cid)
                    .eq("status", "shortlisted");

                if (!shortlisted || shortlisted.length === 0) {
                    return scanResponse("error", recruit.name, "Not shortlisted", undefined, 400);
                }

                // Allocating token_number is a read-then-write race (max() then insert),
                // so retry a bounded number of times: on a unique_violation, first check
                // whether it's the (recruit_id, panel_id) constraint (this recruit truly
                // is already checked in) vs. the (panel_id, token_number) constraint (a
                // concurrent scan of a DIFFERENT recruit grabbed the same token number —
                // in which case we recompute the max and retry, rather than incorrectly
                // reporting this recruit as already checked in).
                const MAX_TOKEN_ALLOCATION_ATTEMPTS = 5;
                for (let attempt = 0; attempt < MAX_TOKEN_ALLOCATION_ATTEMPTS; attempt++) {
                    const { data: maxRow } = await supabase
                        .from("recruit_interview_tokens")
                        .select("token_number")
                        .eq("panel_id", panel_id)
                        .order("token_number", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    const nextTokenNumber = (maxRow?.token_number ?? 0) + 1;

                    const { data: inserted, error: insertError } = await supabase
                        .from("recruit_interview_tokens")
                        .insert({
                            cycle_id: cid,
                            recruit_id: rid,
                            panel_id,
                            token_number: nextTokenNumber,
                            status: "waiting",
                        })
                        .select("token_number")
                        .single();

                    if (!insertError) {
                        return scanResponse(
                            "ok",
                            recruit.name,
                            `Checked in for ${panel.domain_label} — token #${inserted.token_number}`,
                            { token_number: inserted.token_number, panel_label: panel.domain_label }
                        );
                    }

                    if (insertError.code !== UNIQUE_VIOLATION) {
                        throw insertError;
                    }

                    const { data: raceToken } = await supabase
                        .from("recruit_interview_tokens")
                        .select("token_number")
                        .eq("recruit_id", rid)
                        .eq("panel_id", panel_id)
                        .maybeSingle();

                    if (raceToken) {
                        return scanResponse(
                            "already_checked_in",
                            recruit.name,
                            `${recruit.name} already checked in for ${panel.domain_label}`,
                            { token_number: raceToken.token_number, panel_label: panel.domain_label }
                        );
                    }

                    // No row for this recruit on this panel, so the 23505 must have been
                    // a (panel_id, token_number) collision from a concurrent scan of a
                    // different recruit — loop around and recompute the max token.
                }

                return scanResponse(
                    "error",
                    recruit.name,
                    "Could not allocate a check-in token — please try scanning again.",
                    undefined,
                    500
                );
            }

            case "training": {
                // Training has no lead-created "session" step any more (migration 005): a
                // volunteer picks their domain and scans, and the day's session row is
                // created on demand by the first scan.
                if (!sub_domain || !isRecruitSubDomain(sub_domain)) {
                    return scanResponse("error", recruit.name, "Select a training domain first", undefined, 400);
                }

                if (!recruit.is_selected) {
                    return scanResponse("error", recruit.name, "Not a selected recruit", undefined, 400);
                }

                const sessionDate = todayInIST();
                const domainLabel = subDomainFullLabel(sub_domain);
                const sessionLabel = `${domainLabel} — ${sessionDate}`;

                // Find-or-create today's session for this domain — but check for it first
                // rather than always upserting: after the very first scan of the day for a
                // domain, every subsequent scan (the overwhelming majority) can skip the
                // write entirely and go straight to a plain select.
                const { data: existingSession } = await supabase
                    .from("recruit_training_sessions")
                    .select("id")
                    .eq("cycle_id", cid)
                    .eq("session_date", sessionDate)
                    .eq("sub_domain", sub_domain)
                    .maybeSingle();

                let trainingSessionId = existingSession?.id as string | undefined;

                if (!trainingSessionId) {
                    // First scan of the day for this domain — create it. Plain insert (not
                    // upsert): two volunteers scanning the same new domain within a few ms
                    // of each other could both land here, so a unique_violation is expected
                    // and handled by re-reading the row the other request created, rather
                    // than clobbering it (which would lose a label a lead renamed by hand).
                    const { data: created, error: insertSessionError } = await supabase
                        .from("recruit_training_sessions")
                        .insert({ cycle_id: cid, session_date: sessionDate, sub_domain, session_label: sessionLabel })
                        .select("id")
                        .single();

                    if (insertSessionError) {
                        if (insertSessionError.code !== UNIQUE_VIOLATION) {
                            console.error("Error creating training session:", insertSessionError);
                            return scanResponse("error", recruit.name, "Could not open today's training session", undefined, 500);
                        }
                        const { data: raceSession } = await supabase
                            .from("recruit_training_sessions")
                            .select("id")
                            .eq("cycle_id", cid)
                            .eq("session_date", sessionDate)
                            .eq("sub_domain", sub_domain)
                            .maybeSingle();
                        if (!raceSession) {
                            return scanResponse("error", recruit.name, "Could not open today's training session", undefined, 500);
                        }
                        trainingSessionId = raceSession.id;
                    } else {
                        trainingSessionId = created.id;
                    }
                }

                // Insert directly rather than checking-then-inserting, same reasoning as
                // orientation mode above — the unique (recruit_id, session_id) constraint
                // is the actual arbiter either way.
                const { error: insertError } = await supabase.from("recruit_training_attendance").insert({
                    cycle_id: cid,
                    recruit_id: rid,
                    session_id: trainingSessionId,
                    method: "qr",
                    marked_by: scannedBy,
                });

                if (insertError) {
                    if (insertError.code === UNIQUE_VIOLATION) {
                        return scanResponse(
                            "already_scanned",
                            recruit.name,
                            `${recruit.name} already marked present for ${domainLabel} today`,
                            { session_id: trainingSessionId }
                        );
                    }
                    throw insertError;
                }

                // session_id goes back to the scanner so its Undo can target this exact
                // session — the client no longer picks one, so it has no other way to know.
                return scanResponse("ok", recruit.name, `Training attendance marked — ${domainLabel}`, {
                    session_id: trainingSessionId,
                });
            }

            default:
                return scanResponse("error", recruit.name, "Invalid scan mode", undefined, 400);
        }
    } catch (error) {
        console.error("Error in /api/admin/recruitment/scan:", error);
        return scanResponse("error", recruit.name, "Internal server error", undefined, 500);
    }
}
