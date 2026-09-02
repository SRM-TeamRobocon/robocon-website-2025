import { NextResponse } from "next/server";
import { getRecruitSession } from "@/lib/recruit-session";

export const dynamic = "force-dynamic";

// GET /api/recruit/session-check - "is my recruit_token still good?" and nothing else.
//
// This exists purely as the liveness probe for recruitFetch (src/lib/recruit-fetch-client.ts),
// which needs to tell a genuinely-dead session apart from a one-off 401 before it lets the UI
// sign someone out. It deliberately touches NO database: src/proxy.ts has already verified the
// JWT by the time this handler runs, so a 200 here costs one signature check and nothing more.
//
// /api/recruit/me used to play this role, but it runs ~8 Supabase queries and recomputes
// per-domain pipeline status - under exam-day load it is the likeliest endpoint in the whole
// recruit API to time out, and a timed-out probe was being read as "logged out".
export async function GET() {
    const session = await getRecruitSession();
    if (!session) {
        return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ success: true });
}
