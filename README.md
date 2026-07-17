# SRM Team Robocon Website

Next.js website for SRM Team Robocon with public pages, workshop/event registration, attendance tooling, and a Supabase-backed content backend.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS
- Google Sheets / Apps Script for attendance and registrations
- Razorpay for paid workshop registration
- SMTP via Nodemailer for registration emails
- JWT-protected admin dashboard for event operations
- Supabase Postgres + Storage for editable website content

## Local Setup

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

## Environment Variables

Use `.env.example` as the source of truth. Do not commit `.env.local`.

Supabase backend:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Attendance and Google Sheets:

- `GOOGLE_SCRIPT_URL`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_WEBHOOK_URL`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_SITE_URL`

Payments and email:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `SMTP_EMAIL`
- `SMTP_PASSWORD`
- `ORGANIZER_EMAIL`

Existing admin auth:

- `JWT_SECRET`
- `LEAD_ACCOUNTS`
- `DESK_ACCOUNTS`

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

### One-time content migration

`scripts/migrate-content.ts` (run via `npm run migrate:content`) was used to seed the live Supabase project from the original hardcoded sources — including pulling team members from their live Google Sheets feed (`fetchDataUrl` in the old `team/page.tsx`, more current than the static `public/team/data.json`) — and re-uploading every referenced photo into Supabase Storage. It's idempotent-unsafe (plain inserts, no dedupe), so don't rerun it against a populated database without clearing the tables first. Kept for reference/re-seeding a fresh project.

## MCPs That Help Codex Work Well

- Filesystem/repo MCP: inspect and edit project files safely.
- GitHub MCP: inspect PRs, branches, issues, commits, and CI.
- Vercel MCP: inspect deployments, build logs, production env vars, and runtime failures.
- Supabase MCP: inspect schema, RLS policies, storage buckets, table rows, and migrations.
- Google Sheets/Drive MCP: debug attendance and registration sheet integrations.
- Browser or Playwright MCP: test admin flows, scanner pages, uploads, and responsive UI.

For backend work, Supabase + Vercel + Browser/Playwright are the highest-value combo.
