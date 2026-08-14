// Greedy character-based sliding-window chunking for admin-uploaded .txt knowledge-base
// files. No tokenizer dependency — character counts are a fine enough proxy for chunk
// size at this scale (a handful of admin-authored documents, not a bulk corpus).
export function chunkText(text: string, chunkSize = 1000, overlap = 150): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    const chunks: string[] = [];
    let start = 0;
    while (start < trimmed.length) {
        const end = Math.min(start + chunkSize, trimmed.length);
        const chunk = trimmed.slice(start, end).trim();
        if (chunk) chunks.push(chunk);
        if (end >= trimmed.length) break;
        start = end - overlap;
    }

    return chunks;
}
