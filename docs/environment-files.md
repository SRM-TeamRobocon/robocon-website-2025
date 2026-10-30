# Environment files

- `.env.local` remains the complete local Next.js environment.
- `.env.supabase.old` and `.env.supabase.new` keep the old and replacement Supabase settings separate. The new file still needs its server key.
- `.env.recruitment.local`, `.env.attendance.local`, and `.env.integrations.local` are private copies grouped by area.
- `.env.vercel.local` isolates the short-lived Vercel OIDC token.
- `.env.backup` holds the `_BACKUP` values that were previously mixed into `.env.local`.
- `env-templates/recruitment.env.example` is a secret-free checklist that can be shared with a recruitment API developer.

The local subset files are reference/copy files; Next.js does not load them automatically. Use `.env.local` for local Next.js runs. Vercel settings are separate and must be changed in the Vercel project.

Do not send `.env.local`, `.env.backup`, `.env.*.local`, or `.env.supabase.*` to another developer. In particular, `SUPABASE_SERVICE_ROLE_KEY` grants broad server-side database access. Give a developer credentials issued for their own environment, or keep that key in Vercel and let them use the API endpoint.
