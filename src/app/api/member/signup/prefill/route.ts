import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
    MEMBER_GOOGLE_PENDING_COOKIE,
    verifyPendingGoogleProfile,
} from "@/lib/member-oauth";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";

export const dynamic = "force-dynamic";

export async function GET() {
    const cookieStore = await cookies();
    const pending = await verifyPendingGoogleProfile(cookieStore.get(MEMBER_GOOGLE_PENDING_COOKIE)?.value);
    if (!pending) {
        return NextResponse.json({ success: false, error: "Your Google sign-in expired. Please continue with Google again." }, { status: 401 });
    }

    try {
        const supabase = createRecruitSupabaseAdminClient();
        const { data: recruits, error } = await supabase
            .from("recruit_accounts")
            .select("id, cycle_id, name, srm_email, reg_no, department, course, phone")
            .eq("google_uid", pending.google_uid)
            .order("created_at", { ascending: false })
            .limit(1);

        if (error) {
            console.error("member signup prefill lookup error", error);
            return NextResponse.json({ success: false, error: "Could not load your recruitment details." }, { status: 500 });
        }

        const recruit = recruits?.[0];
        return NextResponse.json({
            success: true,
            found: Boolean(recruit),
            profile: recruit
                ? {
                      name: recruit.name || "",
                      email: recruit.srm_email || "",
                      regNo: recruit.reg_no || "",
                      department: recruit.department || "",
                      course: recruit.course || "",
                      phone: recruit.phone || "",
                  }
                : null,
        });
    } catch (error) {
        console.error("member signup prefill error", error);
        return NextResponse.json({ success: false, error: "Could not load your recruitment details." }, { status: 500 });
    }
}
