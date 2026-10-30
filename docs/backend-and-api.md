# Backend and database

Read the retained [Supabase walkthrough](SUPABASE-API-GUIDE.md) beside the handler.
Exact contracts and permissions come from current source, not dated prose.

| Client | File | Access |
| --- | --- | --- |
| Typed server admin | [`admin.ts`](../src/lib/supabase/admin.ts) | Service role; bypasses RLS |
| Recruitment admin | [`recruit-admin.ts`](../src/lib/supabase/recruit-admin.ts) | Untyped service role, same project |
| Public | [`public.ts`](../src/lib/supabase/public.ts) | Anonymous key; RLS applies |
| Browser | [`client.ts`](../src/lib/supabase/client.ts) | Public credentials only |
| Direct Postgres | [`db.js`](../db.js) | `DATABASE_URL`; server/scripts only |

Public reads use [`api/content/[resource]/route.ts`](../src/app/api/content/[resource]/route.ts).
[`content-resources.ts`](../src/lib/content-resources.ts) defines resource fields,
allowlists, and normalization. Shared
[`admin CRUD`](../src/app/api/admin/content/[resource]/route.ts) backs named aliases.
Contact submissions are private, not public content.

For a new field inspect the resource config, schema/types, admin form, public
consumer, and fallback data. For an API follow a neighboring handler: await params,
validate inputs, authorize roles/ownership, handle errors, and update callers.
Content reads return `{ data: ... }`; other route families have different contracts.
Do not add a universal response wrapper.

[`supabase`](../supabase) contains `schema.sql` for main content/member operations,
`recruit-schema.sql` plus numbered recruitment changes, `bazaar.sql`/`bazaar2.sql`,
attendance subscription SQL, and performance indexes. Entities include `members`,
`member_accounts`, `projects`, `events`, `gallery`, `contact_submissions`,
`attendance_logs`, `recruit_accounts`, and `recruitment_cycles`.

This is not a verified one-command migration chain. Duplicate 004/005 prefixes and
incremental patches require a maintainer to confirm what the target has applied.
Do not run all SQL alphabetically or rerun the full schema on production. Keep
schema, types, validation, RLS, and API docs aligned. Service-role access still
requires route authorization.

Asset URLs can be stored in database rows or constructed dynamically. Absence from
an import search does not justify deleting an asset. No live database was audited
as part of this repository cleanup.
