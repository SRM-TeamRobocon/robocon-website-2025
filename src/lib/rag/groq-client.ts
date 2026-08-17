import "server-only";

// Groq chat completions via its OpenAI-compatible REST endpoint — plain fetch, no SDK
// (same "no dependency for a simple JSON endpoint" reasoning as embeddings.ts).
//
// Keys are grouped into numbered TIERS, one env var per tier, each holding a
// bracketed list:
//
//     GROQ1=[gsk_aaa, gsk_bbb, gsk_ccc]
//     GROQ2=[gsk_ddd, gsk_eee]
//
// Tiers are tried in order: GROQ1 is the primary pool, and GROQ2 is only reached once
// every key in GROQ1 has failed with a retryable error (429 / 5xx / network). Within a
// tier, selection is round-robin with automatic failover to the tier's next key. Each
// tier keeps its own rotation cursor, module-scoped, so it persists across requests
// within one warm server process (not globally coordinated across serverless instances
// — fine for this traffic volume).
//
// Add a key by editing a tier's list; add a whole backup account by adding the next
// GROQ<n> var. Neither needs a code change.

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Upper bound on the tier scan. Gaps are tolerated (GROQ1 + GROQ3 works), so a
// commented-out tier doesn't silently hide the ones after it.
const MAX_TIERS = 10;

// Lenient on purpose: the brackets are optional, quotes are optional, and a trailing
// comma is fine — an env var is a plain string, so the brackets are decoration for
// readability rather than syntax we want to fail on.
function parseKeyList(raw: string | undefined): string[] {
    if (!raw) return [];

    const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "");

    const keys = inner
        .split(",")
        .map((k) => k.trim().replace(/^["']/, "").replace(/["']$/, "").trim())
        .filter(Boolean);

    return Array.from(new Set(keys));
}

function getTiers(): string[][] {
    const tiers: string[][] = [];

    for (let i = 1; i <= MAX_TIERS; i++) {
        const keys = parseKeyList(process.env[`GROQ${i}`]);
        if (keys.length > 0) tiers.push(keys);
    }

    if (tiers.length === 0) {
        // Legacy single-var form: GROQ_API_KEYS=key1,key2 — one flat tier.
        const legacy = parseKeyList(process.env.GROQ_API_KEYS);
        if (legacy.length > 0) tiers.push(legacy);
    }

    return tiers;
}

// One cursor per tier, indexed alongside getTiers()'s output.
const cursors: number[] = [];

export async function groqChatCompletion(systemPrompt: string, userMessage: string): Promise<string> {
    const tiers = getTiers();
    if (tiers.length === 0) {
        throw new Error("No Groq keys configured (set GROQ1=[key, ...]) — cannot reach Groq.");
    }

    let lastError: Error | null = null;

    for (let tier = 0; tier < tiers.length; tier++) {
        const keys = tiers[tier];

        // Bounded by the tier's key count so a persistently failing tier falls through
        // to the next one instead of looping.
        for (let attempt = 0; attempt < keys.length; attempt++) {
            const cursor = cursors[tier] ?? 0;
            const key = keys[cursor % keys.length];
            cursors[tier] = (cursor + 1) % keys.length;

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
                lastError = new Error(
                    `Groq request failed (${res.status}) on GROQ${tier + 1} — trying next key.`
                );
                continue;
            }

            // Any other error (bad request, invalid key, etc.) is not retryable — fail
            // fast rather than burning through every key and tier on a genuine problem.
            const body = await res.text().catch(() => "");
            throw new Error(`Groq request failed (${res.status}): ${body.slice(0, 300)}`);
        }
    }

    throw lastError ?? new Error("All Groq API keys were exhausted.");
}
