> Historical README retained for operational context. Contains obsolete routes and auth guidance; use ../README.md and ../authentication.md for current setup. Do not execute migration instructions from this snapshot.

# SRM Team Robocon Website

Next.js website for SRM Team Robocon with public pages, workshop/event registration, attendance tooling, and a Supabase-backed content backend.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS
- Google Sheets / Apps Script for workshop/event registrations
- Supabase-backed RFID office attendance (ESP32 + `/api/attendance/*`)
- SMTP via Nodemailer for registration emails
- JWT-protected admin dashboard for event operations
- Supabase Postgres + Storage for editable website content

## Local Setup

Use Node.js 24 for local development. The repository pins this version in `.nvmrc` and
declares it in `package.json`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Useful commands:

```bash
npm run dev
npm run build
./node_modules/.bin/tsc --noEmit
npm run test:email
```

`npm run lint` currently calls `next lint`, which is not compatible with this installed Next.js version.

## Direct Postgres Connection (`db.js`)

[`db.js`](./db.js) exports a `postgres` (npm) connection for use in scripts and server-side admin utilities.
It reads `DATABASE_URL` from the environment.

Connection parameters:
```
host:     db.fcdaqslblhrjzioeuloe.supabase.co
port:     5432
database: postgres
user:     postgres
```

Add to `.env.local`:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.fcdaqslblhrjzioeuloe.supabase.co:5432/postgres
```

> If the password contains special characters, percent-encode them in the connection string.

## Scheduled Cron Jobs

All crons are in [`vercel.json`](./vercel.json). **Vercel crons run in UTC** — IST = UTC + 5:30.

| Path | UTC Schedule | IST Time | Purpose |
|---|---|---|---|
| `/api/attendance/auto-checkout` | `30 18 * * *` | 00:00 IST | Force-close open lab sessions at midnight |
| `/api/cron/attendance-reminders` | `30 16 * * *` | **22:00 IST (10pm)** | Email + push members still checked IN to tap out |
| `/api/cron/academia-sync` | `0 1 * * *` | 06:30 IST | Sync day-order from SRMIST Academia portal |
| `/api/cron/bazaar-reminders` | `0 4 * * *` | 09:30 IST | Remind borrowers of overdue Bazaar loans |

All cron routes require `Authorization: Bearer $CRON_SECRET`. Vercel automatically attaches this when `CRON_SECRET` is set.

**Troubleshooting the 10pm attendance reminder emails** (`/api/cron/attendance-reminders`):
- Emails are sent via Gmail SMTP (`getRecruitmentBulkMailTransporter()`), not Brevo.
- If emails are not arriving: verify `SMTP_PASSWORD_GOOGLE` (Gmail App Password) **and** `SMTP_EMAIL` are set in Vercel env vars. If either is missing, the cron fires but emails are silently skipped — there is no error visible in the cron log.
- Also verify `CRON_SECRET` matches across `vercel.json` and Vercel env vars.

## Environment Variables

Use `.env.example` as the source of truth. Do not commit `.env.local`.

Supabase (REST API — used by app code via supabase-js):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Supabase (direct Postgres — used by `db.js` and scripts):

- `DATABASE_URL` — full connection string: `postgresql://postgres:[PASSWORD]@db.fcdaqslblhrjzioeuloe.supabase.co:5432/postgres`

Workshop/event registration (Google Sheets):

- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_WEBHOOK_URL`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `CRON_SECRET` — also guards `/api/attendance/auto-checkout` below
- `NEXT_PUBLIC_SITE_URL`

Office RFID attendance (Supabase-backed — see `attendance/main.ino`):

- `ATTENDANCE_DEVICE_SECRET` — bearer secret the ESP32 scanner sends to `/api/attendance/tap`; must match `deviceSecret` in the firmware. Falls back to `"local-dev"` if unset, which is only safe for local testing.
- `GOOGLE_SCRIPT_URL` is no longer used — the old Apps-Script-backed attendance system was replaced by Supabase (`attendance_logs`/`rfid_pairing_requests` tables, `member_accounts.rfid_uid`). Safe to remove once the old Apps Script deployment is decommissioned.

Attendance phone push:

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` — generate a matching key pair with `npx web-push generate-vapid-keys`, then set these in local and deployment environments. Keep the private key server-only. `VAPID_SUBJECT` should be a `mailto:` address or an HTTPS contact URL.
- Apply `supabase/attendance-push-subscriptions.sql` once in the Supabase SQL editor for an existing database. The table has RLS enabled and is only accessible to the server's service role; the same table is included in `supabase/schema.sql` for new databases.
- iPhone users need to add STR Hub to their Home Screen before Safari can enable web push.
- **Troubleshooting notifications**: verify `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are all set in Vercel env vars. All three must be present or push is silently disabled. The browser must also grant notification permission, and iPhone users must add the site to the Home Screen first.

Email:

- `SMTP_EMAIL`
- `SMTP_PASSWORD`
- `ORGANIZER_EMAIL`
- `SMTP_PASSWORD_GOOGLE` — Gmail App Password for the **10pm IST attendance reminder BCC emails** and the recruitment "Send Mail" bulk-BCC feature (`src/lib/mailer.ts`'s `getRecruitmentBulkMailTransporter()`); pairs with `SMTP_EMAIL` as the Gmail account, kept separate from the Brevo SMTP config above.

Existing admin auth:

- `JWT_SECRET`
- `LEAD_ACCOUNTS`
- `DESK_ACCOUNTS`

Recruitment module (see `recruitment.md`; separate `recruit_token` auth, untouched by the above):

- `QR_SECRET` — HMAC key for recruit QR signing
- `RECRUIT_JWT_SECRET` — signs the `recruit_token` cookie
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth, shared by recruit sign-in and member "Sign in with Google" / "Connect Gmail". If you add the member flow, register these extra authorized redirect URIs on the same OAuth client in Google Cloud Console: `/api/member/auth/google/callback` and `/api/member/auth/google/connect/callback`
- `RECRUIT_OTP_FROM_EMAIL` — can reuse `SMTP_EMAIL`

## Supabase Backend

Run `supabase/schema.sql` in the Supabase SQL editor (or via the Supabase MCP `apply_migration` tool). It creates:

- `members` — name, role, domain, year, photo_url, linkedin_url, instagram_url, facebook_url, is_active, display_order
- `projects` — title, description, abstract, cover_image_url, cover_width/cover_height, gallery_urls[], shortkey, tech_stack[], year, competition, display_order
- `achievements` — title, description, abstract, cover_image_url, cover_width/cover_height, gallery_urls[], achievement_date, competition, rank, display_order
- `events` — title, description, abstract, cover_image_url, cover_width/cover_height, gallery_urls[], event_date, location, registration_link, is_upcoming, display_order
- `alumni` — name, domain, designation, about, description, profession, batch, photo_url, linkedin_url, instagram_url, facebook_url, display_order
- `gallery` — image_url, title, category, content, display_order
- `contact_submissions` — private, no public-read policy (admin-only via service role)
- public storage buckets: `member-photos`, `gallery`, `event-posters`, `project-covers`, `achievement-images`, `media`
- public-read RLS policies for all content tables except `contact_submissions`

Admin writes go through server-side API routes using `SUPABASE_SERVICE_ROLE_KEY`. All `/api/admin/*` routes (API and UI) are protected by `src/proxy.ts`, which checks the `admin_token` JWT cookie set at login — no per-route auth code is needed.

Main backend routes:

- `GET /api/content/:resource` for public content reads (all resources except `contact_submissions`)
- `GET/POST/PUT/DELETE /api/admin/content/:resource` for protected admin CRUD
- `GET/POST/PUT/DELETE /api/admin/members`, `/api/admin/projects`, `/api/admin/achievements`, `/api/admin/events`, `/api/admin/alumni`, and `/api/admin/gallery` as spec-named aliases (thin wrappers around the shared content route)
- `GET/PUT /api/admin/messages` for contact submissions
- `POST /api/admin/content/upload` for protected Supabase Storage uploads
- `POST /api/contact` for contact form submissions

Admin UI:

- `/admin/login` — sign in with a `LEAD_ACCOUNTS`/`DESK_ACCOUNTS` username/password
- `/admin/dashboard/content` and `/admin/dashboard/content/:resource` for each of the 7 resources above

### Public pages are Supabase-backed with a static fallback

`team`, `achievements`, `alumni`, `events`, `projects`, and `gallery` all fetch from `/api/content/:resource` on mount and fall back to their original hardcoded data (`constants.ts` arrays / JSON files in `public/`) if the fetch fails or returns no rows — so the site never breaks if Supabase is briefly unreachable. Edit content via the admin CMS; changes appear on the public pages immediately (no rebuild needed).

As of the 2026-08-14 repo cleanup, the local fallback **images** for `achievements` and `alumni` were removed (Supabase is fully populated for both — 14/14 and 50/50 rows respectively — so the fallback path is unused in practice); the fallback text/data still exists, it just has no local photo to point to if that path is ever hit. `events`, `projects`, `gallery`, and `team`'s fallback assets that are still actively referenced were left untouched.

### One-time content migration

`scripts/migrate-content.ts` (previously run via `npm run migrate:content`) seeded the live Supabase project from the original hardcoded sources and re-uploaded every referenced photo into Supabase Storage. It was removed in the 2026-08-14 cleanup along with the local photo directories it depended on (`public/team/photos11`, `public/alumni/photos`, `public/gallery/photos`) — Supabase is already fully seeded and this script can't run again without those source files. A backup zip of everything removed in that cleanup exists outside the repo if a fresh re-seed is ever needed.

## MCPs That Help Codex Work Well

- Filesystem/repo MCP: inspect and edit project files safely.
- GitHub MCP: inspect PRs, branches, issues, commits, and CI.
- Vercel MCP: inspect deployments, build logs, production env vars, and runtime failures.
- Supabase MCP: inspect schema, RLS policies, storage buckets, table rows, and migrations.
- Google Sheets/Drive MCP: debug attendance and registration sheet integrations.
- Browser or Playwright MCP: test admin flows, scanner pages, uploads, and responsive UI.

For backend work, Supabase + Vercel + Browser/Playwright are the highest-value combo.
