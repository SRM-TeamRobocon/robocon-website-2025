# Bazaar references

Bazaar is implemented under `src/app/dashboard/bazaar`, `src/app/api/bazaar`,
`src/lib/bazaar`, and `src/components/bazaar`. Its SQL is in `supabase/bazaar.sql`
and `supabase/bazaar2.sql`; its shared name is `BAZAAR_NAME` in
[`config.ts`](../../src/lib/bazaar/config.ts).

The retained `00`–`05` documents and `DISCOVERY.md` are original feature plans and
a dated discovery snapshot. They were previously ignored. Preserve their design
context, but verify routes, roles, theme rules, and schema against current source.
Their instructions to create tables or run implementation phases are historical,
not authorization to rerun those operations. AGENTS.md governs current UI edits.

Start with [`auth.ts`](../../src/lib/bazaar/auth.ts) for access checks and
[`validation.ts`](../../src/lib/bazaar/validation.ts) for request constraints.
The original Cline-specific guidance remains in
[`.clinerules/bazaar.md`](../../.clinerules/bazaar.md).
