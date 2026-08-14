import { NextRequest, NextResponse } from "next/server";
import { getRecruitSession } from "@/lib/recruit-session";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { embedTexts } from "@/lib/rag/embeddings";
import { answerQuestion, NO_CONTEXT_FALLBACK } from "@/lib/rag/answer";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;
const MATCH_COUNT = 5;

// POST /api/recruit/chat — RAG chat over admin-uploaded .txt knowledge-base files only.
// Non-streaming for v1 (no streaming-route precedent exists anywhere in this codebase
// yet). No chat history is persisted server-side — the widget keeps it in local state.
export async function POST(request: NextRequest) {
    const session = await getRecruitSession();
    if (!session) {
        return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

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

    try {
        const [queryEmbedding] = await embedTexts([message], "query");

        const supabase = createRecruitSupabaseAdminClient();
        const { data: matches, error } = await supabase.rpc("match_recruit_kb_chunks", {
            query_embedding: queryEmbedding,
            match_count: MATCH_COUNT,
        });

        if (error) {
            console.error("recruit chat: retrieval error", error);
            return NextResponse.json({ success: false, error: "Could not answer right now." }, { status: 500 });
        }

        const contextChunks = (matches ?? []).map((m: any) => m.content as string);

        // No KB content to retrieve from at all (e.g. nothing uploaded yet) — return the
        // fallback directly rather than calling the LLM with empty context.
        if (contextChunks.length === 0) {
            return NextResponse.json({ success: true, answer: NO_CONTEXT_FALLBACK });
        }

        const answer = await answerQuestion(message, contextChunks);

        return NextResponse.json({ success: true, answer });
    } catch (err) {
        console.error("recruit chat error", err);
        return NextResponse.json({ success: false, error: "Could not answer right now." }, { status: 500 });
    }
}
