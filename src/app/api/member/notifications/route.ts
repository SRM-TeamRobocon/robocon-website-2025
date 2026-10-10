import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { getAttendancePushPublicKey } from "@/lib/attendance-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function hashEndpoint(endpoint: string) {
    return createHash("sha256").update(endpoint).digest("hex");
}

type MemberAuth =
    | { ok: true; memberAccountId: string }
    | { ok: false; response: NextResponse };

async function getMemberAccountId(): Promise<MemberAuth> {
    const session = await getSession();
    if (!requireRole(session, ["member"])) {
        return { ok: false, response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
    }
    if (!session.memberAccountId) {
        return { ok: false, response: NextResponse.json({ success: false, error: "No member account is linked to this login." }, { status: 400 }) };
    }
    return { ok: true, memberAccountId: session.memberAccountId };
}

export async function GET() {
    const auth = await getMemberAccountId();
    if (!auth.ok) return auth.response;

    const publicKey = getAttendancePushPublicKey();
    if (!publicKey) {
        return NextResponse.json({ success: false, error: "Push notifications are not configured yet." }, { status: 503 });
    }

    return NextResponse.json({ success: true, publicKey });
}

export async function POST(request: Request) {
    const auth = await getMemberAccountId();
    if (!auth.ok) return auth.response;

    if (!getAttendancePushPublicKey()) {
        return NextResponse.json({ success: false, error: "Push notifications are not configured on the server yet." }, { status: 503 });
    }

    let body: {
        endpoint?: unknown;
        expirationTime?: unknown;
        keys?: { p256dh?: unknown; auth?: unknown };
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: "Invalid subscription." }, { status: 400 });
    }

    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
    const keyAuth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
    try {
        if (new URL(endpoint).protocol !== "https:") throw new Error("Invalid endpoint.");
    } catch {
        return NextResponse.json({ success: false, error: "Invalid subscription endpoint." }, { status: 400 });
    }
    if (endpoint.length > 2048 || !p256dh || p256dh.length > 256 || !keyAuth || keyAuth.length > 256) {
        return NextResponse.json({ success: false, error: "Invalid subscription keys." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("attendance_push_subscriptions").upsert({
        member_account_id: auth.memberAccountId,
        endpoint,
        endpoint_hash: hashEndpoint(endpoint),
        p256dh,
        auth: keyAuth,
        expiration_time: typeof body.expirationTime === "number" ? body.expirationTime : null,
    }, { onConflict: "endpoint_hash" });

    if (error) {
        console.error("Attendance push: subscription save failed", error);
        return NextResponse.json({ success: false, error: "Could not enable notifications for this device." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
    const auth = await getMemberAccountId();
    if (!auth.ok) return auth.response;

    let endpoint: unknown;
    try {
        endpoint = (await request.json()).endpoint;
    } catch {
        return NextResponse.json({ success: false, error: "Invalid subscription." }, { status: 400 });
    }
    if (typeof endpoint !== "string" || endpoint.length > 2048) {
        return NextResponse.json({ success: false, error: "Invalid subscription endpoint." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
        .from("attendance_push_subscriptions")
        .delete()
        .eq("member_account_id", auth.memberAccountId)
        .eq("endpoint_hash", hashEndpoint(endpoint));

    if (error) {
        console.error("Attendance push: subscription removal failed", error);
        return NextResponse.json({ success: false, error: "Could not disable notifications for this device." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
