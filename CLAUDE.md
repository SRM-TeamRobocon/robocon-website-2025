# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Next.js website for SRM Team Robocon: public marketing pages (team, projects, achievements, alumni, events, gallery, blog), workshop/event registration with Razorpay payments, a QR-based attendance system backed by Google Sheets, and a role-gated dashboard for content management, blogs, timetables, and member onboarding.

Stack: Next.js App Router + React + TypeScript, Tailwind CSS, Supabase (Postgres + Storage), Razorpay, Nodemailer/SMTP, Google Sheets/Apps Script, JWT sessions via `jose`.

## Commands

```bash
npm install
npm run dev              # http://localhost:3000
npm run build
./node_modules/.bin/tsc --noEmit   # typecheck (no dedicated tsc script)
npm run test:email       # tsx scripts/test-email.ts — sanity-checks SMTP config
npm run migrate:content  # tsx --env-file=.env.local scripts/migrate-content.ts — see below, don't rerun blindly
```

`npm run lint` calls `next lint`, which is not compatible with the installed Next.js version — don't rely on it. There is no automated test suite beyond `test:email`; verify changes with `tsc --noEmit` and manual/browser checks.

## Architecture

### Auth: one JWT cookie, three roles

All auth — staff and members alike — is a single `admin_token` JWT cookie (HS256 via `jose`), signed in [route.ts](src/app/api/admin/login/route.ts) and read by [session.ts](src/lib/session.ts) (`getSession()` / `requireRole()`). The role lives in the token payload as `"lead" | "admin" | "member"`.

Two very different credential sources feed the same login endpoint:
- **Staff accounts**: `LEAD_ACCOUNTS` env var (JSON username→password map). Despite the name, logging in with a `LEAD_ACCOUNTS` credential grants the **`admin`** role, not `lead`. `DESK_ACCOUNTS` is documented in the README/env vars but is not read anywhere in the login route — treat it as unused/stale.
- **Member accounts**: rows in the `member_accounts` Supabase table (see below), checked by email+bcrypt after the staff-account check fails. Their `role` column (`member`/`lead`/`admin`) is set at signup (`member`) and can be promoted later by an admin/lead via `PATCH /api/admin/member-approvals`.

Route protection is centralized in [proxy.ts](src/proxy.ts) (Next middleware): it gates `/dashboard/*`, `/scanner/*`, and `/api/admin/*` (except `/api/admin/login`) by verifying the `admin_token` cookie. **No per-route auth code is needed for those paths** — routes still call `getSession()`/`requireRole()` themselves when they need the specific role or user identity, but the "is anyone logged in" check already happened in middleware. `/api/member/*` routes are public at the middleware level and check role/ownership themselves (e.g. verifying a member only edits their own timetable). Client components enforce role-based UI redirects via [use-require-role.ts](src/hooks/use-require-role.ts), which calls `/api/admin/me`.

Both `JWT_SECRET` reads fall back to a hardcoded string (`fallback_secret_robocon_2026_!@#`) if the env var is unset — fine for local dev, a real risk if ever missing in production.

**The README's "Admin UI" section (`/admin/login`, `/admin/dashboard/content`) is stale.** The actual routes are `/login`, `/signup`, `/verify`, `/forgot-password`, and `/dashboard/*` (no `/admin` prefix in the App Router tree) — there is no `src/app/admin` directory. Trust the routes under `src/app/`, not that section of the README.

### Member lifecycle: signup → email verify → admin approval → roster link

New members self-register via `POST /api/member/signup` ([route.ts](src/app/api/member/signup/route.ts)), restricted to `@srmist.edu.in` emails, inserted into `member_accounts` with `email_verified=false`. A verification email (Nodemailer, [mailer.ts](src/lib/mailer.ts)) links to `/verify?token=...`. After verification, the account sits as `is_approved=false` until a lead/admin approves it from the "Member Approvals" panel (`/api/admin/member-approvals`).

Approval does one of two things:
1. Seeds a new row in the public `members` roster table (the one that powers the public Team page), linked via `member_account_id`, defaulting to `is_active=false` so the lead can flesh out role/photo/etc. before publishing, or
2. Merges the account into an *existing* unlinked roster row (`mergeIntoRosterId`) — for members who were already on the public team roster before they had a login.

The account's plaintext password is kept **reversibly encrypted** (`password_enc`, [password-enc.ts](src/lib/password-enc.ts)) alongside the bcrypt hash purely so the approval email can include it for the member to log in with; `password_enc` is nulled out immediately after that email sends. Don't add new code paths that read `password_enc` outside of an approval-email context.

Mentors are just `members` rows with `domain = "MENTORS"` (see [mentors/route.ts](src/app/api/admin/mentors/route.ts)) and are filtered out of the member-approvals "unlinked roster" list.

### Content CMS: one config, many resources

Six public content types (`members`, `projects`, `achievements`, `events`, `alumni`, `gallery`) plus admin-only `contact_submissions` are all driven by a single schema in [content-resources.ts](src/lib/content-resources.ts) (`CONTENT_RESOURCES`) — field names, types, sort order, per-resource labels. Adding a field to a resource means editing this config (and the DB column in [schema.sql](supabase/schema.sql)), not writing new route logic.

- `GET /api/content/:resource` — public read, no auth, straight Supabase query using the resource's `orderBy`/`ascending`. Excludes `contact_submissions`.
- `GET/POST/PUT/DELETE /api/admin/content/:resource` — generic protected CRUD using the same config, plus spec-named aliases `/api/admin/{members,projects,achievements,events,alumni,gallery}` (thin wrappers, same underlying logic).
- `normalizePayload()` in the same file coerces raw form input into DB-shaped values per field type (`tags` → array from comma-split, `boolean` → `Boolean()`, `datetime` → ISO string, etc.) — reuse it rather than hand-rolling payload coercion.

**Public pages read from Supabase with a static fallback.** `team`, `achievements`, `alumni`, `events`, `projects`, `gallery` fetch `/api/content/:resource` client-side on mount and fall back to hardcoded data (`src/constants/constants.ts` arrays or JSON under `public/`) if the fetch fails or returns zero rows. This means the site degrades gracefully if Supabase is unreachable, but it also means **editing the hardcoded fallback data only matters until Supabase has real rows** — the CMS wins once populated.

### Member-submitted content edits (approval queue)

Members with dashboard access can propose edits to CMS resources without direct write access, via `content_edits` rows (`resource`, `action` = `create`/`update`, `record_id`, `payload`, `status` = `pending`/`approved`/`rejected`). `POST /api/member/content-edits` creates a pending edit; `PATCH /api/admin/content-edits` ([route.ts](src/app/api/admin/content-edits/route.ts)) is where a lead/admin approves (which re-runs the same `normalizePayload()` + upsert against the real table) or rejects with a note. This is the same pattern as the blogs approval flow below — "member proposes, lead/admin reviews, apply-on-approve."

### Blogs

Member-authored blog posts ([blog.ts](src/lib/blog.ts)) go through the same pending/approved/rejected status cycle, stored as a block array (`heading`/`paragraph`/`image`) rather than rich HTML — `sanitizeBlocks()` enforces block count/length limits server-side regardless of client input. Slugs are generated with `slugify()` + `ensureUniqueSlug()`, but a race on identical titles is still possible, so callers must handle the unique-violation (`isSlugConflict()`) by retrying the insert, not just trusting the pre-check.

### Attendance & registration (Google Sheets, not Supabase)

Workshop/event registration and attendance are a separate system from the Supabase CMS, backed by a Google Sheet via a service account ([googleSheets.ts](src/utils/googleSheets.ts)). Registration rows track per-session attendance across up to 3 event days (columns S–X, `SESSION_COLUMN_MAP`), plus a legacy single-column attendance field (col R) kept for backward compatibility. The `/scanner` page + `/api/admin/scan` do QR check-in/out; `/api/attendance/auto-checkout` is a cron-triggered endpoint (guarded by `CRON_SECRET` as a bearer token, defaulting to `"local-dev"`) that force-checks-out anyone still checked in at day end.

Paid workshop registration goes through Razorpay (`/api/payment/create-order` → client-side checkout → `/api/payment/verify`); there's also a manual/offline registration path (`/api/payment/submit-manual-registration`) for non-card payments. Amounts are validated server-side against a hardcoded expected price — if you add a new paid workshop tier, update that check, not just the client form.

### Supabase schema

Run [schema.sql](supabase/schema.sql) in the Supabase SQL editor (or via the Supabase MCP `apply_migration` tool — this repo's `.mcp.json` wires up the Supabase MCP server). Tables: `members`, `projects`, `achievements`, `events`, `alumni`, `gallery`, `contact_submissions`, `member_accounts`, `content_edits`, `blogs`, `timetables`. Public storage buckets: `member-photos`, `gallery`, `event-posters`, `project-covers`, `achievement-images`, `media`. Public-read RLS on all content tables except `contact_submissions` (admin-only, service-role reads). Admin writes always go through server-side routes using `SUPABASE_SERVICE_ROLE_KEY` ([admin.ts](src/lib/supabase/admin.ts)); public reads use the anon client ([public.ts](src/lib/supabase/public.ts)).

`scripts/migrate-content.ts` was a one-time seed from the old hardcoded/Google-Sheets sources into Supabase (including re-uploading photos into Storage). It's **idempotent-unsafe** — plain inserts, no dedupe — so don't rerun it against a populated database without clearing tables first. Kept for reference/re-seeding a fresh project only.

### Timetables

Member weekly timetables ([timetable.ts](src/lib/timetable.ts)) are a fixed grid: 5 rows (`DAYS` = `DO1`..`DO5` — these are spreadsheet row labels from the source data, not actual weekday names) × 10 time slots, each cell one of `""`/`class`/`lab`/`online`. `normalizeSchedule()` clamps any client-submitted grid to this shape (unknown days dropped, rows padded/truncated, invalid cell values reset to `""`) before it's ever persisted — always go through it rather than trusting client JSON.

## Path alias

`@/*` maps to `src/*` (see [tsconfig.json](tsconfig.json)).
