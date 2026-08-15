# How Supabase API calls work in this project

A walkthrough of the actual pattern used in this codebase, so you can add a new
field, table, or route yourself without having to ask each time. Every code
reference is a real file in this repo — open it side by side with this doc.

## 1. The big picture

Nothing in the browser talks to Supabase directly except two public read paths
(explained in §5). Everything else goes through a **Next.js API route**
running on the server. The flow is always:

```
Browser (fetch)  -->  Next.js API route (src/app/api/**/route.ts)
                        |
                        v
                  Supabase client (server-side, has real credentials)
                        |
                        v
                  Postgres (your tables)
                        |
                        v
                  route.ts returns NextResponse.json({...})
                        |
                        v
Browser reads response.json()
```

The API route is just a normal TypeScript function. It is not magic — it's the
same `fetch`-shaped request/response cycle as any REST API, wrapped in Next's
file-based routing (`src/app/api/foo/route.ts` → `POST /api/foo`).

## 2. Two Supabase clients, two trust levels

This repo creates the Supabase client differently depending on **who is
allowed to see the data**.

| Client | File | Key used | Bypasses RLS? | Used for |
|---|---|---|---|---|
| Admin | [`src/lib/supabase/admin.ts`](../src/lib/supabase/admin.ts) | `SUPABASE_SERVICE_ROLE_KEY` | Yes | All `/api/admin/*` routes, all writes |
| Public | [`src/lib/supabase/public.ts`](../src/lib/supabase/public.ts) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No — RLS applies | `/api/content/:resource` public reads |
| Recruit admin | [`src/lib/supabase/recruit-admin.ts`](../src/lib/supabase/recruit-admin.ts) | `SUPABASE_SERVICE_ROLE_KEY` | Yes | All `/api/admin/recruitment/*` and `/api/recruit/*` routes |

**Why a separate "recruit admin" client?** The typed `Database` type in
`src/lib/supabase/types.ts` is generated from `schema.sql` only — it doesn't
know about `recruit_*` tables (they live in `supabase/recruit-schema.sql`).
`recruit-admin.ts` is the same service-role client but untyped, so TypeScript
doesn't complain when you `.from("recruit_accounts")`.

**RLS (Row Level Security)**: every table has RLS *enabled*, but almost none
of them have a public policy defined — meaning the anon key can `SELECT`
public content tables (members, projects, etc. — those do have a public-read
policy) but can't touch anything else. The service-role key ignores RLS
entirely, which is why every admin/write route uses it. This means **auth
protection for admin routes is NOT coming from RLS** — it's coming from the
JWT session check (`getSession()` / `requireRole()`) that each route runs
before touching Supabase at all. If you ever call the admin client without
that check first, you've opened an unauthenticated write endpoint.

## 3. A real public read route, line by line

[`src/app/api/content/[resource]/route.ts`](../src/app/api/content/[resource]/route.ts):

```ts
export async function GET(_request: NextRequest, context: RouteContext) {
  const { resource } = await context.params;          // "members", "projects", etc — from the URL
  const config = getContentResource(resource);         // look up field/table config

  const supabase = createPublicSupabaseClient();        // anon-key client, RLS applies

  const { data, error } = await supabase
    .from(config.table)
    .select("*")
    .order(config.orderBy, { ascending: config.ascending });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], configured: true });
}
```

Call it from a browser or curl — no auth needed:

```bash
curl http://localhost:3000/api/content/members
```

## 4. A real admin CRUD route, line by line

[`src/app/api/admin/content/[resource]/route.ts`](../src/app/api/admin/content/[resource]/route.ts)
handles all four verbs for six resources (members/projects/achievements/etc)
off **one shared config** instead of six separate files. This is the pattern
to copy for any new "list, create, edit, delete" admin feature.

```ts
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSession();                          // read+verify the admin_token cookie
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getConfig(context);
  const body = await request.json();                           // parse the request body
  const payload = normalizePayload(config, body);               // coerce strings -> arrays/booleans/etc

  const supabase = createSupabaseAdminClient();                 // service-role client
  const { data, error } = await supabase
    .from(config.table)
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
```

The browser side ([`AdminContentManager.tsx`](../src/components/admin/AdminContentManager.tsx)):

```ts
const response = await fetch(`/api/admin/content/${config.table}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(activeRow),
});
const json = await response.json();
if (!response.ok) throw new Error(json.error || "Failed to save");
```

That's the whole loop: form → `fetch` → route.ts → Supabase → Postgres →
JSON back → UI updates from `json.data`.

## 5. supabase-js query cheatsheet (what you'll actually type)

```ts
supabase.from("table_name")
  .select("*")                       // SELECT * -- or "id, name" for specific columns
  .select("*, gallery_albums(id)")   // join a related table by FK
  .eq("id", someId)                  // WHERE id = someId
  .order("created_at", { ascending: false })
  .single()                          // expect exactly one row, error otherwise
  .insert({ name: "x" })             // INSERT ... RETURNING (add .select() to get the row back)
  .update({ name: "x" }).eq("id", id)
  .delete().eq("id", id)
```

Every call returns `{ data, error }` — **never throws**. Always check `error`
explicitly; a forgotten check is the most common bug in this codebase's
routes (search for `if (error)` in any route file to see the convention).

## 6. Adding a new field to an existing content resource

Three places, in this order:
1. `supabase/schema.sql` — add the column (then run it in the Supabase SQL
   editor, or via `mcp__supabase__apply_migration`).
2. [`src/lib/content-resources.ts`](../src/lib/content-resources.ts) — add
   the field to that resource's `fields` array (name/label/type). This alone
   makes it show up in the admin form and be included in `normalizePayload()`.
3. Nothing else — the generic CRUD route and public GET route read the config,
   they don't hardcode field names.

## 7. Adding a brand new table/route

There's no single "generic" pattern for a wholly new table (only the six
content resources share the config-driven route). Instead, copy the shape of
an existing focused route, e.g. anything under
`src/app/api/admin/recruitment/*` — each is a small route.ts that:
1. `getSession()` + `requireRole()` first, always.
2. Picks the right client — `createSupabaseAdminClient()` for schema.sql
   tables, `createRecruitSupabaseAdminClient()` for recruit_* tables.
3. Runs one or two `.from(...)` calls, checks `error`, returns JSON.

Add the table to `supabase/schema.sql` (or `recruit-schema.sql` if it's
recruitment-related) first, run it against the DB, *then* write the route.

## 8. Debugging a broken call

1. Browser DevTools → Network tab → find the `/api/...` request → check the
   **Response** tab. Every route in this repo returns `{ error: "..." }` on
   failure with a real Postgres error message (constraint violations, missing
   column, etc.) — read it, don't guess.
2. If the response is a generic 500 with no useful body, check the terminal
   running `npm run dev` — uncaught errors log there.
3. To check the DB directly without going through the app, ask me to run a
   read-only query via the Supabase MCP tool, or use the Supabase dashboard's
   SQL editor / Table Editor.
4. Common gotchas specific to this repo:
   - Forgetting `requireRole()` → every write silently 403s for the wrong role.
   - Using `createSupabaseAdminClient()` on a `recruit_*` table → TypeScript
     error, because that client is typed against `schema.sql` only.
   - `normalizePayload()` not called → e.g. a `tags` field submitted as a raw
     comma string instead of an array, which Postgres will reject.

## Questions

Ask inline as they come up — e.g. "why does this route use `.single()`
instead of just taking `data[0]`?" or "walk me through what happens if I
`curl -X POST` this without a cookie" are the kind of concrete questions
worth asking against real code rather than in the abstract.
