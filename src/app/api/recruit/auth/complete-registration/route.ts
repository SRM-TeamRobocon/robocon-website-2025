import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import {
    issueRecruitToken,
    verifyOAuthState,
    OAUTH_STATE_COOKIE,
    RECRUIT_COOKIE_NAME,
    RECRUIT_COOKIE_OPTIONS,
} from "@/lib/recruit-session";
import { isRecruitSubDomain, subDomainFullLabel } from "@/lib/recruit-domains";
import { isHostelBlock } from "@/lib/hostel-blocks";
import { isTravelMethod } from "@/lib/travel-method";
import { isGender } from "@/lib/gender";
import { safeHttpUrl, boundedText, FIELD_LIMITS } from "@/lib/recruit-validation";
import { signQR } from "@/lib/recruit-qr";
import { getTransporter, SMTP_EMAIL, logoAttachment } from "@/lib/mailer";
import { buildIdCardHtml } from "@/lib/recruit-id-card-email";

export const dynamic = "force-dynamic";

// Postgres unique_violation. Raised by the per-cycle uniqueness indexes on
// upper(reg_no) and lower(srm_email) added in migration 006.
const UNIQUE_VIOLATION = "23505";

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const statePayload = await verifyOAuthState(cookieStore.get(OAUTH_STATE_COOKIE)?.value);

        if (!statePayload) {
            return NextResponse.json(
                { success: false, error: "Your session expired. Please verify your SRM email again." },
                { status: 401 }
            );
        }

        if (!statePayload.srm_verified || !statePayload.srm_email) {
            return NextResponse.json(
                { success: false, error: "Please verify your SRM email before completing registration." },
                { status: 401 }
            );
        }

        // The Google step is mandatory — see 02-AUTH.md step 1. verify-otp already enforces
        // this, but re-check here so the final write can never land without a google_uid.
        if (!statePayload.google_uid) {
            return NextResponse.json(
                { success: false, error: "Start with Google sign-in before completing registration." },
                { status: 401 }
            );
        }

        const body = await request.json();
        const name = boundedText(body.name || statePayload.name, FIELD_LIMITS.name);
        const regNo = boundedText(body.reg_no, FIELD_LIMITS.reg_no);
        const year = String(body.year || "").trim();
        const gender = isGender(body.gender) ? body.gender : null;
        const department = boundedText(body.department, FIELD_LIMITS.department);
        const course = boundedText(body.course, FIELD_LIMITS.course);
        const phone = String(body.phone || "").trim();
        const password = String(body.password || "");
        const isHosteller = body.is_hosteller === true;
        // Day scholars must land as (false, null, null): the DB check constraint added in
        // migration 004 rejects a block/room on a non-hosteller outright.
        const hostelBlock = isHosteller ? boundedText(body.hostel_block, FIELD_LIMITS.hostel_block) : null;
        const hostelRoom = isHosteller ? boundedText(body.hostel_room, FIELD_LIMITS.hostel_room) : null;
        // Day-scholar-only counterparts, same (isHosteller ? ... : null) shape as above so a
        // hosteller can never land with these set — the DB check constraint backstops this.
        const dayScholarArea = !isHosteller ? boundedText(body.day_scholar_area, FIELD_LIMITS.day_scholar_area) : null;
        const travelMethod = !isHosteller && isTravelMethod(body.travel_method) ? body.travel_method : null;
        const domains: string[] = Array.isArray(body.domains) ? body.domains.map((d: unknown) => String(d)) : [];

        // Only http(s) URLs. This value is rendered as a clickable link in the admin
        // dashboard, so a `javascript:` URL here would be stored XSS executing in a
        // logged-in lead's session.
        const rawPortfolio = body.portfolio_url ? String(body.portfolio_url) : "";
        const portfolioUrl = rawPortfolio ? safeHttpUrl(rawPortfolio) : null;
        if (rawPortfolio && !portfolioUrl) {
            return NextResponse.json(
                { success: false, error: "LinkedIn URL must be a valid http:// or https:// link." },
                { status: 400 }
            );
        }

        if (!name || !regNo || !year || !gender || !department || !course || !phone || !password || !portfolioUrl) {
            return NextResponse.json({ success: false, error: "Fill in all required fields." }, { status: 400 });
        }
        if (!["1", "2", "3"].includes(year)) {
            return NextResponse.json({ success: false, error: "Invalid year of study." }, { status: 400 });
        }
        // SRM registration numbers are "RA" + 13 digits (15 chars). Validating the shape
        // rather than just the length stops typos that would otherwise land as a
        // near-duplicate of a real recruit and quietly split their records in two.
        if (!/^RA\d{13}$/i.test(regNo)) {
            return NextResponse.json(
                { success: false, error: "Registration number must be RA followed by 13 digits." },
                { status: 400 }
            );
        }
        // Stored upper-cased so the roster reads consistently. Uniqueness does not depend
        // on this — the unique index in migration 006 is on upper(reg_no) — but it keeps
        // exports and searches from showing the same number in two different spellings.
        const normalizedRegNo = regNo.toUpperCase();
        if (!/^\d{10}$/.test(phone)) {
            return NextResponse.json({ success: false, error: "Phone must be a 10-digit number." }, { status: 400 });
        }
        // Block name is checked against the canonical list rather than stored as free text:
        // it's a column the team filters and sorts on, so a typo'd or injected block name
        // would quietly create a bucket nobody looks in.
        if (isHosteller && !isHostelBlock(hostelBlock)) {
            return NextResponse.json({ success: false, error: "Select a valid hostel block." }, { status: 400 });
        }
        if (isHosteller && !hostelRoom) {
            return NextResponse.json({ success: false, error: "Enter your hostel room number." }, { status: 400 });
        }
        if (!isHosteller && !dayScholarArea) {
            return NextResponse.json({ success: false, error: "Enter the area you live in." }, { status: 400 });
        }
        if (!isHosteller && !travelMethod) {
            return NextResponse.json({ success: false, error: "Select how you travel to college." }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
        }
        if (domains.length < 1 || domains.length > 2) {
            return NextResponse.json({ success: false, error: "Select 1 or 2 domains." }, { status: 400 });
        }
        if (new Set(domains).size !== domains.length) {
            return NextResponse.json({ success: false, error: "Duplicate domain selection." }, { status: 400 });
        }
        if (!domains.every(isRecruitSubDomain)) {
            return NextResponse.json({ success: false, error: "Invalid domain selected." }, { status: 400 });
        }

        const supabase = createRecruitSupabaseAdminClient();

        const { data: cycle } = await supabase
            .from("recruitment_cycles")
            .select("id")
            .eq("is_active", true)
            .maybeSingle();

        if (!cycle) {
            return NextResponse.json({ success: false, error: "Registrations not open" }, { status: 503 });
        }

        const { data: existing } = await supabase
            .from("recruit_accounts")
            .select("id")
            .eq("srm_email", statePayload.srm_email)
            .eq("cycle_id", cycle.id)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ success: false, error: "This email is already registered." }, { status: 409 });
        }

        // Same friendly pre-check for the registration number. Like the email one above
        // this is racy on its own — the unique index from migration 006 is what actually
        // guarantees it, and the 23505 handler below catches the loser of a race.
        const { data: existingRegNo } = await supabase
            .from("recruit_accounts")
            .select("id")
            .ilike("reg_no", normalizedRegNo)
            .eq("cycle_id", cycle.id)
            .maybeSingle();

        if (existingRegNo) {
            return NextResponse.json(
                { success: false, error: "This registration number is already registered." },
                { status: 409 }
            );
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const { data: account, error: insertError } = await supabase
            .from("recruit_accounts")
            .insert({
                cycle_id: cycle.id,
                google_uid: statePayload.google_uid || null,
                personal_email: statePayload.personal_email || null,
                srm_email: statePayload.srm_email,
                srm_email_verified: true,
                name,
                reg_no: normalizedRegNo,
                year,
                gender,
                department,
                course,
                phone,
                is_hosteller: isHosteller,
                hostel_block: hostelBlock,
                hostel_room: hostelRoom,
                day_scholar_area: dayScholarArea,
                travel_method: travelMethod,
                portfolio_url: portfolioUrl,
                password_hash: passwordHash,
            })
            .select("id")
            .single();

        if (insertError || !account) {
            // A unique violation here is not a server fault — it means someone already
            // holds this email or registration number for this cycle. The pre-checks above
            // catch the ordinary case; this catches the race where two submissions both
            // passed their SELECT, and is the only thing that can catch it.
            if (insertError?.code === UNIQUE_VIOLATION) {
                const details = `${insertError.message ?? ""} ${insertError.details ?? ""}`.toLowerCase();
                const isRegNoClash = details.includes("regno");
                return NextResponse.json(
                    {
                        success: false,
                        error: isRegNoClash
                            ? "This registration number is already registered."
                            : "This email is already registered.",
                    },
                    { status: 409 }
                );
            }
            console.error("complete-registration account insert error", insertError);
            return NextResponse.json({ success: false, error: "Could not create account." }, { status: 500 });
        }

        const domainRows = domains.map((sub_domain) => ({
            cycle_id: cycle.id,
            recruit_id: account.id,
            sub_domain,
        }));

        const { error: domainError } = await supabase.from("recruit_domain_selections").insert(domainRows);
        if (domainError) {
            console.error("complete-registration domain insert error", domainError);
            // Best-effort rollback so we don't leave an orphaned account with no domains.
            await supabase.from("recruit_accounts").delete().eq("id", account.id);
            return NextResponse.json({ success: false, error: "Could not save domain selection." }, { status: 500 });
        }

        const transporter = getTransporter();
        if (transporter) {
            try {
                const qrPayload = signQR(account.id, cycle.id);
                const qrBuffer = await QRCode.toBuffer(qrPayload, { width: 500, margin: 2 });
                const html = buildIdCardHtml({
                    name,
                    regNo: normalizedRegNo,
                    year,
                    department,
                    domainLabels: domains.map(subDomainFullLabel),
                });

                // Both addresses collected at registration — send to whichever exist,
                // deduped in case Google's personal address happens to be the SRM one.
                const recipients = Array.from(
                    new Set(
                        [statePayload.srm_email, statePayload.personal_email]
                            .filter((e): e is string => !!e)
                            .map((e) => e.toLowerCase())
                    )
                );

                await transporter
                    .sendMail({
                        from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
                        to: recipients,
                        subject: "Your SRM Team Robocon Recruitment ID Card",
                        text: `Hi ${name}, your recruitment account (${normalizedRegNo}) has been created. Open this email in an HTML-capable client to view your QR ID card.`,
                        html,
                        attachments: [
                            logoAttachment(),
                            { filename: "recruit-qr.png", content: qrBuffer, cid: "recruit_qr" },
                        ],
                    })
                    .catch((err) => console.error("id card email send failed", err));
            } catch (err) {
                console.error("id card email build failed", err);
            }
        } else {
            console.warn("SMTP not configured — skipping ID card email (local dev)");
        }

        const token = await issueRecruitToken({
            recruit_id: account.id,
            srm_email: statePayload.srm_email,
            cycle_id: cycle.id,
        });

        const response = NextResponse.json({ recruit_id: account.id, redirect: "/recruit/dashboard" });
        response.cookies.set({ name: RECRUIT_COOKIE_NAME, value: token, ...RECRUIT_COOKIE_OPTIONS });
        response.cookies.set({ name: OAUTH_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
        return response;
    } catch (error) {
        console.error("complete-registration error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
