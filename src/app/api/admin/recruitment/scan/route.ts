import { NextRequest, NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { verifyQR } from "@/lib/recruit-qr";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { isRecruitSubDomain, subDomainFullLabel } from "@/lib/recruit-domains";
import { todayInIST } from "@/lib/recruit-dates";

export const dynamic = "force-dynamic";

type ScanMode = "orientation" | "exam_day_1" | "exam_day_2" | "exam_walkin" | "interview" | "training";

const VALID_MODES: ScanMode[] = ["orientation", "exam_day_1", "exam_day_2", "exam_walkin", "interview", "training"];

// Postgres unique_violation error code.
const UNIQUE_VIOLATION = "23505";

function scanResponse(
    status: "ok" | "already_scanned" | "already_checked_in" | "not_shortlisted" | "error",
    name: string,
    message: string,
    extra?: { token_number?: number; panel_label?: string; session_id?: string },
    httpStatus = 200
) {
    return NextResponse.json({ status, name, message, ...extra }, { status: httpStatus });
}

// POST /api/admin/recruitment/scan
// Requires admin_token (any of member/lead/admin - all volunteers have at least member).
// Body: { payload, mode, sub_domain? } for a QR scan, OR { recruit_id, mode, sub_domain? }
// for the scanner page's manual-entry fallback (lost/dead phone, camera trouble) - same
// mode-specific business logic either way, just a different source for `rid`. See
// 05-QR-AND-SCANNING.md. Interview mode takes a sub_domain, not a panel_id - the server
// auto-routes to the least-loaded open table for that domain, same UX as exam mode's
// domain picker. Training mode takes a sub_domain (not a session_id): the day's session
// row is created on demand by the first scan, so no lead has to set one up in advance.
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!requireRole(session, ["member", "lead", "admin"])) {
        return NextResponse.json({ status: "error", name: "", message: "Forbidden" }, { status: 403 });
    }

    let body: { payload?: string; recruit_id?: string; mode?: string; sub_domain?: string; force?: boolean };
    try {
        body = await request.json();
    } catch {
        return scanResponse("error", "", "Invalid request body", undefined, 400);
    }

    const { sub_domain, force } = body;
    const mode = body.mode as ScanMode | undefined;

    if (!mode || !VALID_MODES.includes(mode)) {
        return scanResponse("error", "", "Invalid or missing scan mode", undefined, 400);
    }

    // Domain-scoped modes need a valid sub_domain regardless of whether this is a QR scan
    // or a manual entry - checked up front, before any DB call.
    if ((mode === "exam_day_1" || mode === "exam_day_2" || mode === "exam_walkin" || mode === "interview" || mode === "training") && !isRecruitSubDomain(sub_domain)) {
        return scanResponse(
            "error",
            "",
            mode === "interview" ? "Select which domain you are checking in for" : "Select a domain first",
            undefined,
            400
        );
    }

    // `knownCid` is set from the QR payload itself when scanning (it's embedded in the
    // HMAC-signed payload, no DB round trip needed) - null for a manual entry, which has
    // no QR to carry a cycle id and instead just trusts whichever cycle is active.
    const isManual = !body.payload;
    let rid: string;
    let knownCid: string | null = null;

    if (body.payload) {
        const verified = verifyQR(body.payload);
        if (!verified) {
            return scanResponse("error", "", "Invalid QR", undefined, 400);
        }
        rid = verified.rid;
        knownCid = verified.cid;
    } else if (body.recruit_id) {
        rid = body.recruit_id;
    } else {
        return scanResponse("error", "", "Missing QR payload or recruit selection", undefined, 400);
    }

    const supabase = createRecruitSupabaseAdminClient();

    // Mode-specific reads that don't depend on the recruit/cycle validation results can be
    // batched into the SAME network round trip as the recruit/cycle lookup when we already
    // know the cycle id (the QR-scan hot path) - cuts a full round trip off every
    // exam/interview scan, which matters a lot when a volunteer is working through a queue
    // back to back. A manual entry doesn't know cid until the cycle lookup resolves, so it
    // pays one extra sequential hop instead; that's fine - manual entry is a deliberate,
    // occasional fallback, not the high-volume path this is optimizing.
    const modeReads =
        knownCid && (mode === "exam_day_1" || mode === "exam_day_2" || mode === "exam_walkin")
            ? Promise.all([
                  supabase
                      .from("recruit_domain_selections")
                      .select("id")
                      .eq("recruit_id", rid)
                      .eq("cycle_id", knownCid)
                      .eq("sub_domain", sub_domain as string)
                      .maybeSingle(),
                  supabase
                      .from("recruit_exam_attendance")
                      .select("id, day, is_walkin")
                      .eq("recruit_id", rid)
                      .eq("cycle_id", knownCid)
                      .eq("sub_domain", sub_domain as string)
                      .maybeSingle(),
              ])
            : knownCid && mode === "interview"
              ? Promise.all([
                    supabase
                        .from("recruit_shortlist_status")
                        .select("id")
                        .eq("recruit_id", rid)
                        .eq("cycle_id", knownCid)
                        .eq("sub_domain", sub_domain as string)
                        .eq("status", "shortlisted")
                        .maybeSingle(),
                    supabase
                        .from("recruit_interview_tokens")
                        .select("token_number, panel_id")
                        .eq("recruit_id", rid)
                        .eq("cycle_id", knownCid)
                        .eq("sub_domain", sub_domain as string)
                        .maybeSingle(),
                ])
              : Promise.resolve(null);

    const [[{ data: recruit, error: recruitError }, { data: activeCycle }], modeReadsResult] = await Promise.all([
        Promise.all([
            supabase.from("recruit_accounts").select("id, name, is_selected").eq("id", rid).maybeSingle(),
            supabase.from("recruitment_cycles").select("id").eq("is_active", true).maybeSingle(),
        ]),
        modeReads,
    ]);

    if (recruitError) {
        console.error("Error looking up recruit_accounts:", recruitError);
        return scanResponse("error", "", "Internal server error", undefined, 500);
    }
    if (!recruit) {
        return scanResponse("error", "", "Recruit not found", undefined, 404);
    }
    if (!activeCycle) {
        return scanResponse("error", recruit.name, "No active recruitment cycle", undefined, 503);
    }

    let cid: string;
    if (knownCid !== null) {
        if (knownCid !== activeCycle.id) {
            return scanResponse("error", recruit.name, "QR is from a different cycle", undefined, 400);
        }
        cid = knownCid;
    } else {
        cid = activeCycle.id;
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
            case "exam_day_2":
            case "exam_walkin": {
                // null for a walk-in - it is a catch-up sitting, not tied to either
                // scheduled day. See supabase/recruit-migration-021-exam-walkin.sql.
                const day = mode === "exam_day_1" ? 1 : mode === "exam_day_2" ? 2 : null;
                const isWalkin = mode === "exam_walkin";
                const domainLabel = subDomainFullLabel(sub_domain as string);

                // The eligibility check (did they apply to this domain?) and the
                // already-scanned check are independent reads - run them together instead
                // of one-after-another. Only mark attendance for an exam the recruit
                // actually applied to, otherwise a mis-set scanner mode silently creates
                // bogus attendance. Walk-in is NOT a bypass of this - it only changes WHEN
                // the exam was sat, never WHETHER the recruit was eligible to sit it, so
                // the same "did not apply" block applies to all three modes unchanged.
                const [{ data: selection }, { data: existing }] = (modeReadsResult as [
                    { data: { id: string } | null },
                    { data: { id: string; day: number | null; is_walkin: boolean } | null },
                ] | null) ??
                    (await Promise.all([
                        supabase
                            .from("recruit_domain_selections")
                            .select("id")
                            .eq("recruit_id", rid)
                            .eq("cycle_id", cid)
                            .eq("sub_domain", sub_domain as string)
                            .maybeSingle(),
                        supabase
                            .from("recruit_exam_attendance")
                            .select("id, day, is_walkin")
                            .eq("recruit_id", rid)
                            .eq("cycle_id", cid)
                            .eq("sub_domain", sub_domain as string)
                            .maybeSingle(),
                    ]));

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
                    const existingWhen = existing.is_walkin ? "Walk-in" : `Day ${existing.day}`;
                    return scanResponse(
                        "already_scanned",
                        recruit.name,
                        `${recruit.name} already scanned for the ${domainLabel} exam (${existingWhen})`
                    );
                }

                const { error: insertError } = await supabase.from("recruit_exam_attendance").insert({
                    cycle_id: cid,
                    recruit_id: rid,
                    sub_domain,
                    day,
                    is_walkin: isWalkin,
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

                return scanResponse(
                    "ok",
                    recruit.name,
                    isWalkin
                        ? `${domainLabel} exam - Walk-in attendance marked`
                        : `${domainLabel} exam - Day ${day} attendance marked`
                );
            }

            case "interview": {
                // 2026-09-03: no longer auto-routed to a specific table. The volunteer still
                // just picks the domain (same UX as exam mode) - the recruit joins that
                // domain's ONE shared waiting pool (panel_id left null) instead of being
                // assigned a table at check-in. A table only "claims" someone the moment an
                // interviewer actually calls them (Call Next, or manually via call-token) -
                // see recruit_allocate_interview_token (migration 024). This replaced the
                // old least-loaded-table auto-routing, which was silently stranding recruits
                // on whichever table happened to be open first while other tables sat with
                // an empty queue and no way to see or pull from the recruits routed
                // elsewhere.
                const domainLabel = subDomainFullLabel(sub_domain as string);

                const [{ data: shortlisted }, { data: existingToken }] = (modeReadsResult as [
                    { data: { id: string } | null },
                    { data: { token_number: number; panel_id: string } | null },
                ] | null) ??
                    (await Promise.all([
                        supabase
                            .from("recruit_shortlist_status")
                            .select("id")
                            .eq("recruit_id", rid)
                            .eq("cycle_id", cid)
                            .eq("sub_domain", sub_domain as string)
                            .eq("status", "shortlisted")
                            .maybeSingle(),
                        supabase
                            .from("recruit_interview_tokens")
                            .select("token_number, panel_id")
                            .eq("recruit_id", rid)
                            .eq("cycle_id", cid)
                            .eq("sub_domain", sub_domain as string)
                            .maybeSingle(),
                    ]));

                if (existingToken) {
                    const { data: existingPanel } = await supabase
                        .from("recruit_interview_panels")
                        .select("domain_label")
                        .eq("id", existingToken.panel_id)
                        .maybeSingle();
                    return scanResponse(
                        "already_checked_in",
                        recruit.name,
                        `${recruit.name} already checked in for ${existingPanel?.domain_label ?? domainLabel}`,
                        { token_number: existingToken.token_number, panel_label: existingPanel?.domain_label ?? domainLabel }
                    );
                }

                // Not shortlisted (never sat the exam, or sat it and missed cutoff) - don't
                // hard-block. Interview day is walk-in, and a lead/volunteer standing in
                // front of the recruit is in a better position to decide than a cutoff
                // computed days earlier. Report back and let the scanner UI ask "let them
                // in anyway?" rather than silently turning someone away; only proceed past
                // this point once the caller confirms with `force: true`.
                const isWalkin = !shortlisted;
                if (isWalkin && !force) {
                    return scanResponse(
                        "not_shortlisted",
                        recruit.name,
                        `${recruit.name} is not shortlisted for ${domainLabel} - allow as a walk-in interview?`,
                        undefined,
                        200
                    );
                }

                // Still require at least one open table for this domain before letting someone
                // join its shared pool - a domain nobody has opened a table for yet has
                // nowhere for the recruit to eventually be called to. Reuses
                // recruit_interview_open_panels purely for this existence check now (its
                // per-panel waiting_count is no longer needed - nobody's waiting-count belongs
                // to a specific panel any more).
                const { data: openPanels, error: openPanelsError } = await supabase.rpc("recruit_interview_open_panels", {
                    p_cycle_id: cid,
                    p_sub_domain: sub_domain as string,
                });

                if (openPanelsError) throw openPanelsError;

                if (!openPanels || openPanels.length === 0) {
                    return scanResponse("error", recruit.name, `No open table for ${domainLabel} yet - ask a lead to open one`, undefined, 400);
                }

                // Allocating token_number is a read-then-write race, so
                // retry a bounded number of times: on a unique_violation, first check whether
                // it's the (recruit_id, cycle_id, sub_domain) constraint (this recruit truly
                // is already checked in for this domain) vs. the (panel_id, token_number)
                // constraint (a concurrent scan of a DIFFERENT recruit grabbed the same token
                // number on the same table - recompute and retry rather than incorrectly
                // reporting this recruit as already checked in). recruit_allocate_interview_token
                // does the max()-then-insert as one round trip; the retry loop's correctness
                // is otherwise unchanged from before.
                const MAX_TOKEN_ALLOCATION_ATTEMPTS = 5;
                for (let attempt = 0; attempt < MAX_TOKEN_ALLOCATION_ATTEMPTS; attempt++) {
                    const { data: allocatedRaw, error: allocError } = await supabase
                        .rpc("recruit_allocate_interview_token", {
                            p_panel_id: null,
                            p_cycle_id: cid,
                            p_recruit_id: rid,
                            p_sub_domain: sub_domain as string,
                            p_is_walkin: isWalkin,
                        })
                        .single();
                    const allocated = allocatedRaw as { token_number: number } | null;

                    if (!allocError && allocated) {
                        return scanResponse(
                            "ok",
                            recruit.name,
                            isWalkin
                                ? `Walk-in checked in for ${domainLabel} - token #${allocated.token_number}`
                                : `Checked in for ${domainLabel} - token #${allocated.token_number}`,
                            { token_number: allocated.token_number, panel_label: domainLabel }
                        );
                    }

                    if (!allocError || allocError.code !== UNIQUE_VIOLATION) {
                        throw allocError ?? new Error("recruit_allocate_interview_token returned no data and no error");
                    }

                    const { data: raceToken } = await supabase
                        .from("recruit_interview_tokens")
                        .select("token_number, panel_id")
                        .eq("recruit_id", rid)
                        .eq("cycle_id", cid)
                        .eq("sub_domain", sub_domain as string)
                        .maybeSingle();

                    if (raceToken) {
                        return scanResponse(
                            "already_checked_in",
                            recruit.name,
                            `${recruit.name} already checked in for ${domainLabel}`,
                            { token_number: raceToken.token_number, panel_label: domainLabel }
                        );
                    }

                    // No row for this recruit on this domain, so the 23505 must have been a
                    // (panel_id, token_number) collision from a concurrent scan of a different
                    // recruit onto the same table - loop around and recompute the max token.
                }

                return scanResponse(
                    "error",
                    recruit.name,
                    "Could not allocate a check-in token - please try scanning again.",
                    undefined,
                    500
                );
            }

            case "training": {
                // Training has no lead-created "session" step any more (migration 005): a
                // volunteer picks their domain and scans, and the day's session row is
                // created on demand by the first scan.
                if (!recruit.is_selected) {
                    return scanResponse("error", recruit.name, "Not a selected recruit", undefined, 400);
                }

                const sessionDate = todayInIST();
                const domainLabel = subDomainFullLabel(sub_domain as string);
                const sessionLabel = `${domainLabel} - ${sessionDate}`;

                // Find-or-create today's session for this domain - but check for it first
                // rather than always upserting: after the very first scan of the day for a
                // domain, every subsequent scan (the overwhelming majority) can skip the
                // write entirely and go straight to a plain select.
                const { data: existingSession } = await supabase
                    .from("recruit_training_sessions")
                    .select("id")
                    .eq("cycle_id", cid)
                    .eq("session_date", sessionDate)
                    .eq("sub_domain", sub_domain as string)
                    .maybeSingle();

                let trainingSessionId = existingSession?.id as string | undefined;

                if (!trainingSessionId) {
                    // First scan of the day for this domain - create it. Plain insert (not
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
                            .eq("sub_domain", sub_domain as string)
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
                // orientation mode above - the unique (recruit_id, session_id) constraint
                // is the actual arbiter either way.
                const { error: insertError } = await supabase.from("recruit_training_attendance").insert({
                    cycle_id: cid,
                    recruit_id: rid,
                    session_id: trainingSessionId,
                    method: isManual ? "manual" : "qr",
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
                // session - the client no longer picks one, so it has no other way to know.
                return scanResponse("ok", recruit.name, `Training attendance marked - ${domainLabel}`, {
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
