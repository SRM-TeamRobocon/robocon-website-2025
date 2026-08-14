import "server-only";

// Groq chat completions via its OpenAI-compatible REST endpoint — plain fetch, no SDK
// (same "no dependency for a simple JSON endpoint" reasoning as embeddings.ts).
//
// GROQ_API_KEYS is a comma-separated list, for round-robin load balancing across
// multiple free-tier keys. Selection is round-robin WITH automatic failover: a 429
// (rate limited) or 5xx response retries the same request with the next key before
// giving up, bounded by the number of keys so a genuinely bad request can't loop.
// The rotation cursor is module-scoped, so it persists across requests within one
// warm server process (not globally coordinated across serverless instances — fine
// for this traffic volume).

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function getKeys(): string[] {
    return (process.env.GROQ_API_KEYS || "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
}

let cursor = 0;

export async function groqChatCompletion(systemPrompt: string, userMessage: string): Promise<string> {
    const keys = getKeys();
    if (keys.length === 0) {
        throw new Error("GROQ_API_KEYS is not configured — cannot reach Groq.");
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < keys.length; attempt++) {
        const key = keys[cursor % keys.length];
        cursor = (cursor + 1) % keys.length;

        let res: Response;
        try {
            res = await fetch(GROQ_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage },
                    ],
                    max_tokens: 1024,
                }),
            });
        } catch (err) {
            // Network-level failure — retryable, same as a 5xx.
            lastError = err instanceof Error ? err : new Error(String(err));
            continue;
        }

        if (res.ok) {
            const json = await res.json();
            const content = json?.choices?.[0]?.message?.content;
            if (typeof content !== "string") {
                throw new Error("Groq response was malformed.");
            }
            return content;
        }

        if (res.status === 429 || res.status >= 500) {
            lastError = new Error(`Groq request failed (${res.status}) — trying next key.`);
            continue;
        }

        // Any other error (bad request, invalid key, etc.) is not retryable — fail fast
        // rather than burning through every key on a genuine problem.
        const body = await res.text().catch(() => "");
        throw new Error(`Groq request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    throw lastError ?? new Error("All Groq API keys were exhausted.");
}
