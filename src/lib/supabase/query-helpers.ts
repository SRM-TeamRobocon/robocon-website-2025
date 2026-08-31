import "server-only";

import { phoneSearchTerm } from "@/lib/recruit-validation";

// Supabase/PostgREST caps any single response at 1000 rows by default (the project's
// db_max_rows setting), applied silently: a query that would match 1500 rows just comes
// back with the first 1000 and no error, no warning. At the recruitment module's target
// scale (1000-2000 recruits, some picking 2 domains each) several tables — domain
// selections, exam attendance, training attendance — comfortably exceed 1000 rows for a
// single cycle. Any endpoint that must see every matching row (analytics, attendance
// eligibility, CSV export) has to paginate instead of trusting one fetch.

const PAGE_SIZE = 1000;

type RangeQuery<T> = { data: T[] | null; error: unknown };

/**
 * Runs `buildQuery` repeatedly with `.range(from, to)` until a page comes back short of
 * PAGE_SIZE, concatenating every row seen. Use for any query that must return the full
 * result set regardless of table size.
 *
 * @param buildQuery Given a 0-indexed inclusive [from, to] row range, return the
 *   PostgREST query builder (already filtered/ordered) with `.range(from, to)` applied.
 */
export async function fetchAllRows<T>(
    buildQuery: (from: number, to: number) => PromiseLike<RangeQuery<T>>
): Promise<{ data: T[]; error: unknown }> {
    const all: T[] = [];
    let from = 0;

    while (true) {
        const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
        if (error) return { data: all, error };
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return { data: all, error: null };
}

// Keeps `.in("col", ids)` query strings well under any reverse-proxy/URL-length limit —
// at 2000 recruits, a single .in() with every id would be a ~70KB query string.
const IN_CHUNK_SIZE = 150;

/**
 * Splits `ids` into chunks and runs `buildQuery` once per chunk in parallel, concatenating
 * the results. Use for any `.in("col", ids)` filter where `ids` can grow with the number
 * of recruits (as opposed to a small, bounded set like sub-domains or sessions).
 */
export async function selectInChunks<T>(
    ids: string[],
    buildQuery: (chunk: string[]) => PromiseLike<RangeQuery<T>>
): Promise<{ data: T[]; error: unknown }> {
    if (ids.length === 0) return { data: [], error: null };

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
        chunks.push(ids.slice(i, i + IN_CHUNK_SIZE));
    }

    const results = await Promise.all(chunks.map(buildQuery));
    const firstError = results.find((r) => r.error)?.error ?? null;
    const all = results.flatMap((r) => r.data ?? []);

    return { data: all, error: firstError };
}

// Escapes characters that would otherwise break PostgREST's .or() filter syntax
// (comma separates conditions, parentheses group them).
function escapeOrValue(input: string) {
    return input.replace(/[\\,()]/g, (c) => `\\${c}`);
}

/**
 * Builds the PostgREST `.or()` filter behind the recruit search box, or null for an empty
 * term. Shared by the recruits list and its CSV export so a download can never contain a
 * different set of rows than the table it was triggered from.
 */
export function recruitSearchOrFilter(search: string): string | null {
    const trimmed = search.trim();
    if (!trimmed) return null;

    const raw = escapeOrValue(trimmed);
    const clauses = [`name.ilike.%${raw}%`, `reg_no.ilike.%${raw}%`];

    // Phone is stored as bare digits, so a pasted "+91 98765 43210" only matches once the
    // separators are stripped — but stripping them from the name/reg_no terms would break
    // those, hence two different terms off the one input. phoneSearchTerm() returns null
    // under 3 digits so a lone digit inside a name search can't match hundreds of numbers.
    const phone = phoneSearchTerm(trimmed);
    if (phone) clauses.push(`phone.ilike.%${escapeOrValue(phone)}%`);

    return clauses.join(",");
}
