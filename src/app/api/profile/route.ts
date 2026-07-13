import { NextResponse } from "next/server";
import { CONTENT_RESOURCES, normalizePayload } from "@/lib/content-resources";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const PROFILE_SELECT = "id, name, role, domain, year, photo_url, linkedin_url, instagram_url, facebook_url";

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin", "member"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    if (session.memberAccountId) {
        const { data } = await supabase
            .from("members")
            .select(PROFILE_SELECT)
            .eq("member_account_id", session.memberAccountId)
            .maybeSingle();

        if (!data) {
            return NextResponse.json({ success: false, error: "Your profile isn't set up yet." }, { status: 404 });
        }
        return NextResponse.json({ success: true, claimed: true, data });
    }

    // Legacy env-based staff login — no member_accounts row, link by env username instead.
    const { data: claimedRow } = await supabase
        .from("members")
        .select(PROFILE_SELECT)
        .eq("lead_username", session.user)
        .maybeSingle();

    if (claimedRow) {
        return NextResponse.json({ success: true, claimed: true, data: claimedRow });
    }

    const { data: candidates } = await supabase
        .from("members")
        .select("id, name, role, domain")
        .is("lead_username", null)
        .order("name", { ascending: true });

    return NextResponse.json({ success: true, claimed: false, candidates: candidates ?? [] });
}

export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["lead", "admin", "member"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const payload = normalizePayload(CONTENT_RESOURCES.members, body.payload || {});
        delete payload.is_active;
        delete payload.display_order;

        const supabase = createSupabaseAdminClient();

        if (session.memberAccountId) {
            const { data: existing } = await supabase
                .from("members")
                .select("id")
                .eq("member_account_id", session.memberAccountId)
                .maybeSingle();

            if (!existing) {
                return NextResponse.json({ success: false, error: "Your profile isn't set up yet." }, { status: 404 });
            }

            const { data, error } = await (supabase.from("members") as any).update(payload).eq("id", existing.id).select(PROFILE_SELECT).single();
            if (error) return NextResponse.json({ success: false, error: "Could not update profile." }, { status: 500 });
            return NextResponse.json({ success: true, data });
        }

        // Legacy env-based staff: claim (existing row or new) before/while applying the edit.
        const { data: claimedRow } = await supabase
            .from("members")
            .select("id")
            .eq("lead_username", session.user)
            .maybeSingle();

        let targetId = claimedRow?.id as string | undefined;

        if (!targetId) {
            if (body.createNew) {
                const { data: created, error } = await (supabase.from("members") as any)
                    .insert({ ...payload, lead_username: session.user, name: payload.name || session.name || session.user, role: payload.role || "Team Member", is_active: true })
                    .select("id")
                    .single();
                if (error || !created) return NextResponse.json({ success: false, error: "Could not create profile." }, { status: 500 });
                targetId = created.id;
            } else if (body.claimRowId) {
                const { data: row } = await supabase.from("members").select("id, lead_username").eq("id", body.claimRowId).maybeSingle();
                if (!row || row.lead_username) {
                    return NextResponse.json({ success: false, error: "That entry is unavailable to claim." }, { status: 409 });
                }
                const { error } = await supabase.from("members").update({ lead_username: session.user }).eq("id", body.claimRowId);
                if (error) return NextResponse.json({ success: false, error: "Could not claim profile." }, { status: 500 });
                targetId = body.claimRowId;
            } else {
                return NextResponse.json({ success: false, error: "Claim an existing entry or create a new one first." }, { status: 400 });
            }
        }

        const { data, error } = await (supabase.from("members") as any).update(payload).eq("id", targetId).select(PROFILE_SELECT).single();
        if (error) return NextResponse.json({ success: false, error: "Could not update profile." }, { status: 500 });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("profile PATCH error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
