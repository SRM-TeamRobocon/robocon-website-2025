import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { issueRecruitToken, RECRUIT_COOKIE_NAME, RECRUIT_COOKIE_OPTIONS } from "@/lib/recruit-session";

export const dynamic = "force-dynamic";

// A precomputed cost-12 hash of a value nobody can supply. Compared against when no
// account matches, so a miss costs the same ~250ms as a hit — otherwise the response
// time difference is a clean oracle for enumerating which students have registered.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.eS7uqxGSbmt/8fZ1oHV7ZVvUJ7Zx0Iq";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const srmEmail = String(body.srm_email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!srmEmail || !password) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const supabase = createRecruitSupabaseAdminClient();

        const { data: cycle } = await supabase
            .from("recruitment_cycles")
            .select("id")
            .eq("is_active", true)
            .maybeSingle();

        // No active cycle → same "Invalid credentials" response, never reveal why.
        if (!cycle) {
            await bcrypt.compare(password, DUMMY_HASH);
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const { data: account } = await supabase
            .from("recruit_accounts")
            .select("id, srm_email, password_hash")
            .eq("srm_email", srmEmail)
            .eq("cycle_id", cycle.id)
            .maybeSingle();

        // Always spend the same bcrypt time whether or not the account exists.
        const matches = await bcrypt.compare(password, account?.password_hash ?? DUMMY_HASH);

        if (!account || !matches) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const token = await issueRecruitToken({
            recruit_id: account.id,
            srm_email: account.srm_email,
            cycle_id: cycle.id,
        });

        const response = NextResponse.json({ redirect: "/recruit/dashboard" });
        response.cookies.set({ name: RECRUIT_COOKIE_NAME, value: token, ...RECRUIT_COOKIE_OPTIONS });
        return response;
    } catch (error) {
        console.error("recruit login error", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
