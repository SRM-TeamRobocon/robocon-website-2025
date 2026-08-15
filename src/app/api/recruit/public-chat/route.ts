import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { embedTexts } from "@/lib/rag/embeddings";
import { answerQuestion, NO_CONTEXT_FALLBACK } from "@/lib/rag/answer";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;
const MATCH_COUNT = 5;
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// POST /api/recruit/public-chat — same RAG pipeline as /api/recruit/chat, but with no
// recruit_token requirement (explicitly carved out of the gate in src/proxy.ts) so
// homepage visitors who haven't registered yet can use the "Ask a Doubt" widget on
// RecruitmentSection. Rate-limited by hashed IP instead of session, since there's no
// auth to lean on for abuse control — see recruit-migration-014.
function clientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();
    return request.headers.get("x-real-ip") || "unknown";
}

function hashIp(ip: string): string {
    return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: NextRequest) {
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
        return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        return NextResponse.json({ success: false, error: "Message is too long" }, { status: 400 });
    }

    const ipHash = hashIp(clientIp(request));
    const supabase = createRecruitSupabaseAdminClient();

    // Opportunistic cleanup — keeps the log table bounded without needing a cron job.
    // Best-effort: a failure here shouldn't block an otherwise-valid request.
    void supabase
        .from("recruit_public_chat_requests")
        .delete()
        .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count, error: countError } = await supabase
        .from("recruit_public_chat_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", windowStart);

    if (countError) {
        console.error("public-chat: rate-limit check error", countError);
        return NextResponse.json({ success: false, error: "Could not answer right now." }, { status: 500 });
    }

    if ((count ?? 0) >= RATE_LIMIT) {
        return NextResponse.json(
            { success: false, error: "Too many questions from this connection — try again in a few minutes." },
            { status: 429 }
        );
    }

    await supabase.from("recruit_public_chat_requests").insert({ ip_hash: ipHash });

    try {
        const [queryEmbedding] = await embedTexts([message], "query");

        const { data: matches, error } = await supabase.rpc("match_recruit_kb_chunks", {
            query_embedding: queryEmbedding,
            match_count: MATCH_COUNT,
        });

        if (error) {
            console.error("public-chat: retrieval error", error);
            return NextResponse.json({ success: false, error: "Could not answer right now." }, { status: 500 });
        }

        const contextChunks = (matches ?? []).map((m: any) => m.content as string);

        if (contextChunks.length === 0) {
            return NextResponse.json({ success: true, answer: NO_CONTEXT_FALLBACK });
        }

        const answer = await answerQuestion(message, contextChunks);

        return NextResponse.json({ success: true, answer });
    } catch (err) {
        console.error("public-chat error", err);
        return NextResponse.json({ success: false, error: "Could not answer right now." }, { status: 500 });
    }
}
