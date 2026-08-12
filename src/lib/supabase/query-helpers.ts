import "server-only";

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
