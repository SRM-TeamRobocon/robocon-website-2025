import "server-only";

// Voyage AI embeddings - used to turn admin-uploaded .txt chunks (input_type: "document")
// and recruit chat questions (input_type: "query") into comparable vectors for
// recruit_kb_chunks' pgvector column. Plain fetch, no SDK: this is a single simple
// JSON-in/JSON-out endpoint, matching this repo's convention of not adding a dependency
// for something `fetch` handles in a few lines (see src/lib/mailer.ts's lazy-getter
// pattern for the same reasoning applied to SMTP).

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_MODEL = "voyage-3.5";
const VOYAGE_OUTPUT_DIMENSION = 1024;

export async function embedTexts(
    texts: string[],
    inputType: "document" | "query" = "document"
): Promise<number[][]> {
    if (!VOYAGE_API_KEY) {
        throw new Error("VOYAGE_API_KEY is not configured - cannot generate embeddings.");
    }
    if (texts.length === 0) return [];

    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
            input: texts,
            model: VOYAGE_MODEL,
            input_type: inputType,
            output_dimension: VOYAGE_OUTPUT_DIMENSION,
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Voyage embeddings request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const data = json?.data as { embedding: number[] }[] | undefined;
    if (!Array.isArray(data)) {
        throw new Error("Voyage embeddings response was malformed.");
    }

    return data.map((d) => d.embedding);
}
