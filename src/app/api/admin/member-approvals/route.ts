import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: pending, error: pendingError } = await supabase
        .from("member_accounts")
        .select("id, name, email, domain, reg_no, department, course, phone, created_at")
        .eq("email_verified", true)
        .eq("is_approved", false)
        .order("created_at", { ascending: true });

    const { data: approved, error: approvedError } = await supabase
        .from("member_accounts")
        .select("id, name, email, domain, role, approved_at")
        .eq("is_approved", true)
        .order("approved_at", { ascending: false });

    const { data: unlinked, error: unlinkedError } = await supabase
        .from("members")
        .select("id, name, role, domain")
        .is("member_account_id", null)
        .order("name", { ascending: true });

    if (pendingError || approvedError || unlinkedError) {
        console.error("member-approvals list error", pendingError || approvedError || unlinkedError);
        return NextResponse.json({ success: false, error: "Could not load members." }, { status: 500 });
    }

    return NextResponse.json({ success: true, pending, approved, unlinked });
}

export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["lead", "admin"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const { id, role, mergeIntoRosterId } = await request.json();
        if (!id) {
            return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        if (role) {
            if (!["member", "lead", "admin"].includes(role)) {
                return NextResponse.json({ success: false, error: "Invalid role." }, { status: 400 });
            }
            const { error: roleError } = await supabase.from("member_accounts").update({ role }).eq("id", id).eq("is_approved", true);
            if (roleError) {
                console.error("member-approvals role update error", roleError);
                return NextResponse.json({ success: false, error: "Could not update role." }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        if (mergeIntoRosterId) {
            const { data: rosterRow } = await supabase
                .from("members")
                .select("id, member_account_id")
                .eq("id", mergeIntoRosterId)
                .maybeSingle();

            if (!rosterRow) {
                return NextResponse.json({ success: false, error: "Roster entry not found." }, { status: 404 });
            }
            if (rosterRow.member_account_id) {
                return NextResponse.json({ success: false, error: "That entry is already linked to a login." }, { status: 409 });
            }

            const { error: linkError } = await supabase.from("members").update({ member_account_id: id }).eq("id", mergeIntoRosterId);
            if (linkError) {
                console.error("member-approvals merge link error", linkError);
                return NextResponse.json({ success: false, error: "Could not merge into that entry." }, { status: 500 });
            }

            const { error: approveError } = await supabase
                .from("member_accounts")
                .update({ is_approved: true, approved_at: new Date().toISOString() })
                .eq("id", id);
            if (approveError) {
                console.error("member-approvals merge approve error", approveError);
                return NextResponse.json({ success: false, error: "Could not approve member." }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        const { data: account, error: fetchError } = await supabase
            .from("member_accounts")
            .select("id, name, domain")
            .eq("id", id)
            .maybeSingle();

        if (fetchError || !account) {
            return NextResponse.json({ success: false, error: "Member account not found." }, { status: 404 });
        }

        const { error: approveError } = await supabase
            .from("member_accounts")
            .update({ is_approved: true, approved_at: new Date().toISOString() })
            .eq("id", id);

        if (approveError) {
            console.error("member-approvals approve error", approveError);
            return NextResponse.json({ success: false, error: "Could not approve member." }, { status: 500 });
        }

        const { data: existingRoster } = await supabase
            .from("members")
            .select("id")
            .eq("member_account_id", id)
            .maybeSingle();

        if (!existingRoster) {
            const { error: seedError } = await supabase.from("members").insert({
                member_account_id: id,
                name: account.name,
                domain: account.domain,
                role: "Member",
                is_active: false,
            });
            if (seedError) console.error("member-approvals roster seed error", seedError);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("member-approvals PATCH error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
        return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("member_accounts").delete().eq("id", id);

    if (error) {
        console.error("member-approvals reject error", error);
        return NextResponse.json({ success: false, error: "Could not reject member." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
