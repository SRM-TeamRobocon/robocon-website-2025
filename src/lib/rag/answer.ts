import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { groqChatCompletion } from "@/lib/rag/groq-client";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

async function anthropicChatCompletion(systemPrompt: string, userMessage: string): Promise<string> {
    const client = new Anthropic();
    try {
        const response = await client.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
        });
        const textBlock = response.content.find((block) => block.type === "text");
        if (!textBlock || textBlock.type !== "text") {
            throw new Error("Anthropic response had no text content.");
        }
        return textBlock.text;
    } catch (err) {
        if (err instanceof Anthropic.APIError) {
            throw new Error(`Anthropic request failed: ${err.message}`);
        }
        throw err;
    }
}

// Provider-agnostic answer step, selected at call time via RAG_LLM_PROVIDER so the
// concrete LLM can be swapped without touching the chat route. Defaults to "groq" -
// the first provider wired up for this feature (see recruit-dashboard plan, Phase 3
// build order: Groq first, Anthropic added afterward).
const INSTAGRAM_HANDLE = "@srmteamrobocon";
const INSTAGRAM_URL = "https://www.instagram.com/srmteamrobocon/";

// Shared verbatim with the system prompt below, so the chat route can return this exact
// string directly when retrieval finds nothing at all (e.g. no KB documents uploaded
// yet) - deterministic, rather than trusting the LLM to follow instructions for a case
// that's fully knowable before the LLM call ever happens.
export const NO_CONTEXT_FALLBACK =
    `I don't have that information yet - follow ${INSTAGRAM_HANDLE} on Instagram for updates: ${INSTAGRAM_URL}`;

function buildSystemPrompt(contextChunks: string[]): string {
    const context = contextChunks.length > 0 ? contextChunks.join("\n\n---\n\n") : "(no matching context found)";
    return [
        "You are a helpful assistant answering questions from a recruit on SRM Team Robocon's recruitment dashboard.",
        "Answer ONLY using the context below. Do not use any outside knowledge, and do not guess.",
        "If the context does not cover the question, say you don't know, and reply with EXACTLY this sentence " +
            `(reproduce the URL character-for-character, do not alter it): "${NO_CONTEXT_FALLBACK}"`,
        "Keep answers short and direct.",
        "",
        "Context:",
        context,
    ].join("\n");
}

export async function answerQuestion(question: string, contextChunks: string[]): Promise<string> {
    const provider = process.env.RAG_LLM_PROVIDER || "groq";
    const systemPrompt = buildSystemPrompt(contextChunks);

    if (provider === "groq") {
        return groqChatCompletion(systemPrompt, question);
    }

    if (provider === "anthropic") {
        return anthropicChatCompletion(systemPrompt, question);
    }

    throw new Error(`Unknown RAG_LLM_PROVIDER "${provider}" - expected "groq" or "anthropic".`);
}
