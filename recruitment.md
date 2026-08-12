# Recruitment Module — Consolidated Reference

This is the consolidated spec/reference for the SRM Team Robocon recruitment module — the junior-recruitment pipeline (registration → orientation → exam → shortlisting → walk-in interviews → training → onboarding) layered on top of the existing robocon website. It merges what were formerly seven separate numbered docs (`01-OVERVIEW.md` through `07-INTERVIEW-MODULE.md`) plus the session-handoff notes (`summary.md`) into one file. Those seven docs were reconciled with the actual code on 2026-08-09, so the content below reflects what is actually built, not the original intent. The final section preserves the handoff notes' history, gaps, and pending work.

## Table of Contents

1. [Overview](#1-overview)
2. [Auth](#2-auth)
3. [Schema](#3-schema)
4. [Pages & Routes](#4-pages--routes)
5. [QR & Scanning](#5-qr--scanning)
6. [Exam & Shortlisting](#6-exam--shortlisting)
7. [Interview Module](#7-interview-module)
8. [Known Gaps / History](#8-known-gaps--history)

---

## 1. Overview

### What This Module Does

The recruitment module runs the full junior recruitment pipeline on top of the existing robocon website (`robocon-website-2025`). It does NOT replace or touch existing public pages, member CMS, blog system, or existing JWT auth. It adds a parallel recruit-facing auth, a new admin sub-section, new Supabase tables, and new routes — all self-contained under `/recruit/*` (student-facing) and `/dashboard/recruitment/*` (admin).

**Pipeline in order:**

```
Registration (web + G-auth + SRM OTP)
  ↓
Orientation  (QR scan — headcount only, no cutoff effect)
  ↓
Exam Day 1   (QR scan per domain exam — marks entry by evaluator)
  ↓
Exam Day 2   (QR scan per domain exam — marks entry by evaluator)
  ↓
Auto-shortlist against a per-domain cutoff (all 6 domains)
  ↓
Walk-in Interview  (QR check-in → live queue token → panel logs result)
  ↓
Selection
  ↓
3-Week Training  (QR + manual-backup attendance per session)
  ↓
Selected recruits self-signup via existing /signup → lead approval → full member
```

### Domain Structure

There are 6 selectable sub-domains, each belonging to a parent subsystem:

| Sub-domain key   | Display name   | Parent subsystem | Shortlisting method  |
|------------------|----------------|------------------|----------------------|
| `coding`         | Coding         | SPACED           | Written exam + cutoff |
| `webdev`         | Web Dev        | SPACED           | Written exam + cutoff |
| `siesed`         | SIESED         | SIESED           | Written exam + cutoff |
| `corporate`      | Corporate      | MCSOCD           | Written exam + cutoff |
| `vfx_gfx`        | VFX / GFX      | MCSOCD           | Written exam + cutoff |
| `sambed`         | SAMBED         | SAMBED           | Written exam + cutoff |

**All six domains run the identical exam → marks → cutoff → auto-shortlist pipeline.** There is no portfolio-only track. `webdev` and `vfx_gfx` used to be manually-reviewed portfolio domains; that distinction was removed (2026-08-09) and every consumer — scanner, marks, cutoffs, shortlist, analytics — treats all six the same. `src/lib/recruit-domains.ts` is the single source of truth and no longer exports `EXAM_SUBDOMAINS`/`PORTFOLIO_SUBDOMAINS`.

`portfolio_url` survives as a **column name only**: it now holds a LinkedIn URL collected from *every* recruit at registration, not a domain-gated portfolio link. The DB column was left as-is (no migration); UI labels say "LinkedIn".

A student picks **minimum 1, maximum 2** sub-domains at registration. Each domain is evaluated and shortlisted independently — a student can clear one and not the other.

### Multi-Season Design

Every table in this module carries a `cycle_id` foreign key referencing `recruitment_cycles`. This costs nothing now but lets next year's leads reuse the entire system by creating a new cycle instead of rebuilding. Only one cycle is `is_active = true` at a time. All student-facing pages automatically scope to the active cycle. Admin can create a new cycle from `/dashboard/recruitment/cycles`.

### Role Permissions (recruitment context)

The existing `admin_token` JWT roles (`lead`, `admin`, `member`) govern access. No new role is introduced.

| Action | Who |
|--------|-----|
| Create/close recruitment cycle | `admin` or `lead` |
| View all recruits, marks, shortlist, interview results | `admin` or `lead` |
| Enter exam marks (any domain) | `admin` or `lead` — the marks page filters by domain in the UI, but the route does **not** restrict a lead to their own domain |
| Set cutoffs | `admin` or `lead` |
| Create interview panels | `admin` or `lead` |
| Log interview results | `admin` or `lead` |
| Manage training sessions + mark manual attendance | `admin` or `lead` |
| Scan QR (volunteer mode) | `admin`, `lead`, or `member` |
| View own pipeline status, QR code | Recruit (separate `recruit_token` cookie) |

### Key Design Decisions

1. **Recruit auth is completely separate from member auth.** Recruits use a `recruit_token` JWT cookie (same `jose` library). The existing `admin_token` system is untouched.
2. **All new Supabase tables are prefixed `recruit_`.** They never overlap with existing tables (`members`, `member_accounts`, etc.).
3. **QR is static per recruit per cycle** — one QR generated at registration, used across orientation, exam, interview check-in, and training. Payload is HMAC-signed with `QR_SECRET` env var.
4. **Scanner is a new page `/recruit-scanner`** — separate from existing `/scanner` which handles workshop attendance via Google Sheets. They do not share logic.
5. **Shortlisting is cutoff-driven for all six domains.** Leads can still override any individual decision (`method = 'manual_override'`), and the compute engine never touches an overridden row.
6. **Interview panels are ephemeral, created on the day** — lead types a domain name into a text field, panel appears with a live queue. No pre-configuration needed.
7. **After training, recruits self-onboard** — they use the existing `/signup` flow with their verified SRM email and go through the normal lead-approval process.

### What NOT to Touch

- `src/app/(public)/**` — public marketing pages
- `src/app/api/admin/content/**` — CMS routes
- `src/app/api/member/**` — member routes
- `src/app/api/admin/login/**` — existing login (admin JWT)
- `src/lib/session.ts` — do not modify, only import `getSession()`/`requireRole()`
- `supabase/schema.sql` — add new migration file `supabase/recruit-schema.sql`, do NOT edit existing schema.sql
- `tailwind.config.ts` — do not change theme, colors, or fonts
- `/scanner` page — do not modify existing scanner

### New Environment Variables Required

Add these to `.env.local` and Vercel:

```
QR_SECRET=<random 32-char string>          # HMAC key for QR signing
RECRUIT_JWT_SECRET=<random 32-char string>  # signs recruit_token cookie (separate from JWT_SECRET)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<oauth client> # for G-auth on recruit pages
GOOGLE_CLIENT_SECRET=<oauth secret>         # server-side Google OAuth
RECRUIT_OTP_FROM_EMAIL=<email>             # can reuse SMTP_EMAIL if same account
```

---

## 2. Auth

Recruit Auth — Registration, OTP & Login. This covers the full recruit-facing auth system. It is completely separate from the existing member/admin JWT system. Do NOT touch `src/lib/session.ts`, `src/app/api/admin/login`, or `member_accounts`.

### Overview

Recruits have their own auth flow:
1. Google OAuth (personal Gmail) — gets name + personal email
2. SRM email entry + OTP verification — proves they're SRMIST students
3. Fill profile details + set password + pick domain(s)
4. Account created in `recruit_accounts` table
5. Login: either Google OAuth OR SRM email + password → issues `recruit_token` JWT cookie

### Cookie: `recruit_token`

- Signed with `RECRUIT_JWT_SECRET` env var using `jose` (same library as existing `admin_token`)
- Never set `httpOnly: false` — always httpOnly, secure, sameSite strict
- Payload shape:
  ```ts
  {
    recruit_id: string   // uuid from recruit_accounts
    srm_email: string
    cycle_id: string     // uuid of active recruitment_cycles row
    iat: number
    exp: number          // 7 days
  }
  ```
- Helper functions: create `src/lib/recruit-session.ts` with `getRecruitSession()` and `requireRecruitAuth()` — mirror the shape of existing `src/lib/session.ts` but for recruit_token

### Registration Flow (step by step)

#### Step 1 — Google OAuth

Route: `GET /api/recruit/auth/google`

- Redirects to Google OAuth consent screen
- Callback: `GET /api/recruit/auth/google/callback`
- On success: receives `access_token`, fetches `https://www.googleapis.com/oauth2/v2/userinfo` to get:
  ```json
  { "id": "google_uid", "email": "personal@gmail.com", "name": "Full Name", "picture": "..." }
  ```
- Check if a `recruit_accounts` row already exists with this `google_uid` AND `srm_email_verified = true` for the active cycle → if yes, log them in directly (skip to Step 5)
- Store `{ google_uid, personal_email, name }` in a short-lived signed cookie (`recruit_oauth_state`, 15 min) and redirect to `/recruit/register/step2`

**Google OAuth implementation:** Use `googleapis` npm package (`google-auth-library`). Do NOT use Supabase Auth — the existing Supabase setup is Postgres-only, not Supabase Auth. Add `googleapis` as a dependency.

#### Step 2 — SRM Email Entry + OTP

Page: `/recruit/register` (shows step 2 after step 1 cookie is detected)
Route: `POST /api/recruit/auth/send-otp`

Request body:
```json
{ "srm_email": "ab1234@srmist.edu.in" }
```

Validations:
- Must match `^[a-zA-Z0-9._%+\-]+@srmist\.edu\.in$`
- Check `recruit_accounts`: if `srm_email` already exists AND `srm_email_verified = true` for this cycle → return 409 "already registered"
- Rate limit: max 3 OTP sends per email per hour (track in `recruit_email_otps`, count rows within last 60 min)

Server actions:
- Generate 6-digit numeric OTP
- Bcrypt-hash it (cost 10)
- Insert into `recruit_email_otps`: `{ srm_email, otp_hash, expires_at: now + 15min, used_at: null }`
- Send email via existing Nodemailer setup (`src/lib/mailer.ts`) — subject: "SRM Team Robocon — OTP Verification", body: plain text with the 6-digit code and 15-min expiry warning
- Return 200 `{ sent: true }`

#### Step 3 — OTP Verification

Route: `POST /api/recruit/auth/verify-otp`

Request body:
```json
{ "srm_email": "ab1234@srmist.edu.in", "otp": "123456" }
```

Server actions:
- Fetch latest unused, unexpired row from `recruit_email_otps` for this srm_email
- If none → 400 "OTP expired or not found"
- Bcrypt compare otp against otp_hash → if mismatch → 400 "Invalid OTP"
- Mark row: `used_at = now()`
- Store `{ srm_email, srm_verified: true }` appended to the `recruit_oauth_state` cookie (re-sign, same 15-min window)
- Return 200 `{ verified: true }`

#### Step 4 — Profile + Domain Selection

Page: `/recruit/register` (shows step 3 form after OTP verified)
Route: `POST /api/recruit/auth/complete-registration`

Form fields collected:
```ts
{
  name: string           // pre-filled from Google, editable
  reg_no: string         // SRM registration number (e.g. RA2211026010001)
  year: "1" | "2" | "3" // current year of study
  department: string     // e.g. "CSE", "ECE", "MECH"
  course: string         // e.g. "B.Tech"
  phone: string          // 10-digit Indian mobile
  password: string       // min 8 chars
  domains: string[]      // 1-2 values from: coding, webdev, siesed, corporate, vfx_gfx, sambed
  portfolio_url?: string // LinkedIn URL — asked of EVERY recruit, not domain-gated.
                         // Field name kept to match the DB column; UI labels say "LinkedIn".
}
```

Validations server-side:
- Read `recruit_oauth_state` cookie → must be valid, not expired, `srm_verified: true`
- `domains.length >= 1 && domains.length <= 2`
- Each domain must be one of the 6 valid sub-domain keys
- `portfolio_url` (LinkedIn) is enforced as **required by the client only** — the register page blocks submit with "LinkedIn URL is required", but the route accepts a missing value and stores `null`. If provided it must pass `safeHttpUrl()`: `http:`/`https:` scheme only, max 500 chars → 400 otherwise. That guard is not cosmetic; the value is rendered as a clickable `<a href>` in the admin shortlist and interview panels, so a `javascript:` URL would be stored XSS against a logged-in lead.
- `reg_no` format: loosely validate non-empty, 10+ chars
- `phone` must be 10 digits

Server actions:
- Bcrypt hash the password (cost 12)
- Get active `recruitment_cycles` row (`is_active = true`) — if none, return 503 "Registrations not open"
- Insert `recruit_accounts` row
- Insert 1-2 `recruit_domain_selections` rows
- Clear `recruit_oauth_state` cookie
- Issue `recruit_token` JWT cookie
- Return 200 `{ recruit_id, redirect: "/recruit/dashboard" }`

### Login Flow

Page: `/recruit/login`

Two paths:

#### Path A — Google OAuth Login

Same `/api/recruit/auth/google` route. On callback, if `recruit_accounts` row found with `google_uid` for active cycle → issue `recruit_token` and redirect to `/recruit/dashboard`. If not found → redirect to `/recruit/register` (new registration).

#### Path B — SRM Email + Password

Route: `POST /api/recruit/auth/login`

Request body:
```json
{ "srm_email": "ab1234@srmist.edu.in", "password": "..." }
```

Server actions:
- Fetch `recruit_accounts` row by `srm_email` + current active cycle
- If not found → 401 "Invalid credentials" (do NOT say "email not found" — avoids enumeration)
- Bcrypt compare password → if mismatch → 401 "Invalid credentials"
- Issue `recruit_token` cookie
- Return 200 `{ redirect: "/recruit/dashboard" }`

### Logout

Route: `POST /api/recruit/auth/logout`
- Clears `recruit_token` cookie
- Redirect to `/recruit/login`

### Middleware Protection

Add recruit routes to `src/proxy.ts` (existing middleware file). Add a second check block:

```ts
// Protect /recruit/dashboard and /api/recruit/* (except auth routes)
if (pathname.startsWith('/recruit/dashboard') || 
    (pathname.startsWith('/api/recruit/') && !pathname.startsWith('/api/recruit/auth/'))) {
  const token = req.cookies.get('recruit_token')?.value
  if (!token) return NextResponse.redirect(new URL('/recruit/login', req.url))
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.RECRUIT_JWT_SECRET))
  } catch {
    return NextResponse.redirect(new URL('/recruit/login', req.url))
  }
}
```

Do NOT change the existing staff/member protection block above it.

### `src/lib/recruit-session.ts` (new file)

```ts
import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

export type RecruitSession = {
  recruit_id: string
  srm_email: string
  cycle_id: string
}

const secret = () => new TextEncoder().encode(
  process.env.RECRUIT_JWT_SECRET ?? 'fallback_recruit_secret_!@#'
)

export async function getRecruitSession(): Promise<RecruitSession | null> {
  const token = (await cookies()).get('recruit_token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as unknown as RecruitSession
  } catch {
    return null
  }
}

export async function requireRecruitAuth(): Promise<RecruitSession> {
  const session = await getRecruitSession()
  if (!session) throw new Error('Not authenticated as recruit')
  return session
}

export async function issueRecruitToken(payload: RecruitSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}
```

### UI Notes (theme must not change)

All recruit-facing pages (`/recruit/*`) must use the existing site theme:
- Font: `font-Aldrich` (already in tailwind config)
- Primary red: `text-red` or `bg-red` (`#C20000` in config)
- Dark backgrounds matching existing pages
- Reuse existing `<Navbar>` and `<Footer>` components if they exist; if not, build matching ones
- Do NOT introduce new color tokens, new fonts, or new global CSS

The registration flow is a **multi-step form on a single page** (`/recruit/register`) that transitions between steps client-side. Use `useState` for step tracking. No page reloads between steps.

---

## 3. Schema

Recruitment Module — Supabase Schema. All new tables live in `supabase/recruit-schema.sql`. Run this file AFTER the existing `supabase/schema.sql`. Never edit `schema.sql` directly.

All recruit tables:
- Are prefixed with `recruit_`
- Have `cycle_id uuid not null references recruitment_cycles(id)` (multi-season support)
- Use `gen_random_uuid()` for primary keys
- Have RLS enabled, with **no public policies** — all reads/writes go through server-side API routes using `SUPABASE_SERVICE_ROLE_KEY` (same pattern as `member_accounts`, `content_edits`, `blogs`)

### Table: `recruitment_cycles`

One row per recruitment season. Only one row has `is_active = true` at a time.

```sql
create table if not exists recruitment_cycles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,              -- e.g. "Robocon 2026"
  year         text not null,              -- e.g. "2025-26"
  is_active    boolean not null default false,
  created_at   timestamptz default now(),
  closed_at    timestamptz                 -- set when cycle is ended
);

alter table recruitment_cycles enable row level security;
-- No public policies.
```

**Rules:**
- Only one row can have `is_active = true` at a time. Enforce in application logic (not DB constraint) — when creating a new cycle, set `is_active = false` on all existing rows, then insert new with `is_active = true`.
- Closing a cycle: set `closed_at = now()` and `is_active = false`.

### Table: `recruit_accounts`

One row per registered student per cycle.

```sql
create table if not exists recruit_accounts (
  id                  uuid primary key default gen_random_uuid(),
  cycle_id            uuid not null references recruitment_cycles(id),
  google_uid          text,                -- from Google OAuth (nullable: set when G-auth used)
  personal_email      text,                -- Gmail from Google OAuth
  srm_email           text not null,       -- verified SRM email
  srm_email_verified  boolean not null default false,
  name                text not null,
  reg_no              text not null,
  year                text not null check (year in ('1', '2', '3')),
  department          text not null,
  course              text not null,
  phone               text,
  portfolio_url       text,                -- LinkedIn URL from every recruit; legacy column name
  password_hash       text not null,
  is_selected         boolean not null default false,  -- RECOMPUTED after every interview-result
                                                       -- write: true iff any result is 'selected'
  created_at          timestamptz default now(),
  unique (srm_email, cycle_id)
);

alter table recruit_accounts enable row level security;
-- No public policies.
```

### Table: `recruit_domain_selections`

Which sub-domains a recruit applied for. Max 2 rows per recruit per cycle.

```sql
create type recruit_subdomain as enum (
  'coding', 'webdev', 'siesed', 'corporate', 'vfx_gfx', 'sambed'
);

create table if not exists recruit_domain_selections (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references recruitment_cycles(id),
  recruit_id  uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain  recruit_subdomain not null,
  created_at  timestamptz default now(),
  unique (recruit_id, sub_domain)
);

alter table recruit_domain_selections enable row level security;
-- No public policies.
```

### Table: `recruit_email_otps`

Stores hashed OTPs for SRM email verification. Cleaned up after use or expiry.

```sql
create table if not exists recruit_email_otps (
  id          uuid primary key default gen_random_uuid(),
  srm_email   text not null,
  otp_hash    text not null,               -- bcrypt of 6-digit code
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz default now()
);

alter table recruit_email_otps enable row level security;
-- No public policies.
```

### Table: `recruit_orientation_attendance`

Records which recruits scanned at orientation. No cutoff effect — headcount only.

```sql
create table if not exists recruit_orientation_attendance (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references recruitment_cycles(id),
  recruit_id  uuid not null references recruit_accounts(id) on delete cascade,
  scanned_at  timestamptz default now(),
  scanned_by  text,                        -- volunteer username or "volunteer"
  unique (recruit_id, cycle_id)            -- one scan per recruit per cycle
);

alter table recruit_orientation_attendance enable row level security;
```

### Table: `recruit_exam_attendance`

Records exam-day QR scans. **One row per recruit per sub-domain**, not per day — a recruit who applied for two domains sits two exams and is scanned once for each, whichever day those exams fall on. `day` (1 or 2) is recorded for reporting but is *not* part of the row's identity.

```sql
create table if not exists recruit_exam_attendance (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references recruitment_cycles(id),
  recruit_id  uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain  recruit_subdomain not null,  -- which domain's exam they sat
  day         integer not null check (day in (1, 2)),
  scanned_at  timestamptz default now(),
  scanned_by  text,
  unique (recruit_id, cycle_id, sub_domain)  -- one scan per recruit per exam
);

alter table recruit_exam_attendance enable row level security;
```

`sub_domain` and this unique key came from **migration 001** (`supabase/recruit-migration-001-exam-subdomain.sql`), which replaced the original `unique (recruit_id, cycle_id, day)`. The migration carries a pre-flight dedup step (keep earliest scan, drop the rest) because seeded data had day-1 + day-2 rows for the same domain that would collide under the new key.

### Table: `recruit_marks`

Evaluator-entered exam marks. **All six domains** get rows here — there is no exam/portfolio split (see [Exam & Shortlisting](#6-exam--shortlisting)).

```sql
create table if not exists recruit_marks (
  id               uuid primary key default gen_random_uuid(),
  cycle_id         uuid not null references recruitment_cycles(id),
  recruit_id       uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain       recruit_subdomain not null,
  marks            integer not null check (marks >= 0 and marks <= 100),
  evaluator_username text not null,        -- admin_token session username
  entered_at       timestamptz default now(),
  updated_at       timestamptz,
  unique (recruit_id, sub_domain, cycle_id)
);

alter table recruit_marks enable row level security;
```

**Note:** A recruit only gets a marks row for domains they actually applied for. `POST /api/admin/recruitment/marks` enforces this server-side against `recruit_domain_selections` — not just in the UI.

### Table: `recruit_cutoffs`

Per-domain cutoff marks, set by admin before shortlisting runs.

```sql
create table if not exists recruit_cutoffs (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references recruitment_cycles(id),
  sub_domain   recruit_subdomain not null,
  cutoff_marks integer not null check (cutoff_marks >= 0 and cutoff_marks <= 100),
  set_by       text not null,             -- admin_token username
  set_at       timestamptz default now(),
  unique (cycle_id, sub_domain)
);

alter table recruit_cutoffs enable row level security;
```

### Table: `recruit_shortlist_status`

One row per (recruit, sub_domain, cycle). Computed automatically by the shortlist engine; can be manually overridden by admin.

```sql
create type shortlist_result as enum ('pending', 'shortlisted', 'not_shortlisted');

create table if not exists recruit_shortlist_status (
  id               uuid primary key default gen_random_uuid(),
  cycle_id         uuid not null references recruitment_cycles(id),
  recruit_id       uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain       recruit_subdomain not null,
  status           shortlist_result not null default 'pending',
  method           text not null default 'auto',  -- 'auto' | 'manual_override' ('portfolio' is legacy, never written)
  override_reason  text,
  overridden_by    text,
  overridden_at    timestamptz,
  computed_at      timestamptz,
  unique (recruit_id, sub_domain, cycle_id)
);

alter table recruit_shortlist_status enable row level security;
```

### Table: `recruit_interview_panels`

Created on interview day by admin. Each panel = one domain queue. `domain_label` is free text typed by the lead (e.g. "Coding", "SIESED"). Not enforced to match a specific sub_domain key — flexibility for leads to name it how they want.

```sql
create table if not exists recruit_interview_panels (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references recruitment_cycles(id),
  domain_label text not null,             -- free-text, typed by lead
  is_active    boolean not null default true,
  created_at   timestamptz default now(),
  created_by   text not null              -- admin_token username
);

alter table recruit_interview_panels enable row level security;
```

### Table: `recruit_interview_tokens`

One row per (recruit, panel). Created when recruit scans QR at interview check-in.

```sql
create type interview_token_status as enum ('waiting', 'called', 'done', 'no_show');

create table if not exists recruit_interview_tokens (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references recruitment_cycles(id),
  recruit_id   uuid not null references recruit_accounts(id) on delete cascade,
  panel_id     uuid not null references recruit_interview_panels(id),
  token_number integer not null,          -- auto-incremented per panel (see note below)
  status       interview_token_status not null default 'waiting',
  checked_in_at timestamptz default now(),
  called_at    timestamptz,
  unique (recruit_id, panel_id)           -- one token per recruit per panel
);

alter table recruit_interview_tokens enable row level security;
```

**Token number auto-increment per panel:** When inserting, run:
```sql
SELECT COALESCE(MAX(token_number), 0) + 1 FROM recruit_interview_tokens WHERE panel_id = $1
```
in the same transaction as the insert. Do this in the API route, not a DB trigger.

### Table: `recruit_interview_results`

One row per (recruit, sub_domain). Logged by panel interviewer.

```sql
create type interview_result as enum ('selected', 'rejected', 'waitlisted');

create table if not exists recruit_interview_results (
  id                  uuid primary key default gen_random_uuid(),
  cycle_id            uuid not null references recruitment_cycles(id),
  recruit_id          uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain          recruit_subdomain not null,
  result              interview_result not null,
  notes               text,
  interviewer_username text not null,
  decided_at          timestamptz default now(),
  unique (recruit_id, sub_domain, cycle_id)
);

alter table recruit_interview_results enable row level security;
```

### Table: `recruit_training_sessions`

Admin creates sessions at the start of training (e.g. "Week 1 — Day 1").

```sql
create table if not exists recruit_training_sessions (
  id            uuid primary key default gen_random_uuid(),
  cycle_id      uuid not null references recruitment_cycles(id),
  session_date  date not null,
  session_label text not null,            -- e.g. "Week 1 — Day 1"
  created_at    timestamptz default now()
);

alter table recruit_training_sessions enable row level security;
```

### Table: `recruit_training_attendance`

One row per (recruit, session). Method is `qr` (scanner) or `manual` (lead marked it manually).

```sql
create table if not exists recruit_training_attendance (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references recruitment_cycles(id),
  recruit_id   uuid not null references recruit_accounts(id) on delete cascade,
  session_id   uuid not null references recruit_training_sessions(id),
  method       text not null check (method in ('qr', 'manual')),
  marked_by    text not null,            -- volunteer username (qr) or lead username (manual)
  scanned_at   timestamptz default now(),
  unique (recruit_id, session_id)
);

alter table recruit_training_attendance enable row level security;
```

### RLS Summary

All tables: `enable row level security` with **no public SELECT/INSERT/UPDATE/DELETE policies**. Every read and write goes through server-side Next.js API routes using `SUPABASE_SERVICE_ROLE_KEY` via `src/lib/supabase/admin.ts` (existing admin Supabase client). Never use the anon client for recruit data.

### Relationships Diagram (text)

```
recruitment_cycles
  └── recruit_accounts (cycle_id)
        └── recruit_domain_selections (recruit_id)
        └── recruit_orientation_attendance (recruit_id)
        └── recruit_exam_attendance (recruit_id)
        └── recruit_marks (recruit_id)
        └── recruit_shortlist_status (recruit_id)
        └── recruit_interview_tokens (recruit_id) → recruit_interview_panels
        └── recruit_interview_results (recruit_id)
        └── recruit_training_attendance (recruit_id) → recruit_training_sessions
```

### Helper: Active Cycle Query

Use this in every API route that scopes to the current cycle:

```ts
const { data: cycle } = await adminSupabase
  .from('recruitment_cycles')
  .select('id')
  .eq('is_active', true)
  .single()

if (!cycle) return NextResponse.json({ error: 'No active recruitment cycle' }, { status: 503 })
```

---

## 4. Pages & Routes

Recruitment Module — Pages & API Routes. All routes and pages introduced by the recruitment module. Nothing here touches existing routes.

### Naming Conventions

- Student-facing pages: `/recruit/*`
- Admin-facing pages: `/dashboard/recruitment/*` (under existing dashboard, new sub-section)
- Student-facing API: `/api/recruit/*`
- Admin API for recruitment: `/api/admin/recruitment/*`
- New scanner page: `/recruit-scanner`

### Student-Facing Pages

#### `/recruit/register`

**What:** Multi-step registration page. Three steps rendered on one page with `useState` step control — no page reloads between steps.

- Step 1: "Continue with Google" button → triggers `/api/recruit/auth/google`
- Step 2 (after G-auth returns): SRM email input + "Send OTP" button + OTP input field (appears after send)
- Step 3 (after OTP verified): Name (pre-filled), Reg No, Year, Department, Course, Phone, LinkedIn URL (always shown, asked of everyone), Password, Domain checkboxes (6 options)
- On submit → `POST /api/recruit/auth/complete-registration` → redirects to `/recruit/dashboard`

**Access:** Public (no auth required, redirects to dashboard if already logged in)

#### `/recruit/login`

**What:** Login page with two options.

- "Sign in with Google" button → `/api/recruit/auth/google`
- SRM email + password form → `POST /api/recruit/auth/login`
- Link to `/recruit/register` for new students

**Access:** Public (redirects to dashboard if already logged in)

#### `/recruit/dashboard`

**What:** Student's personal status page. Shows their pipeline progress.

Displays:
- Name, SRM email, Reg No, selected domain(s)
- Pipeline status per domain (see boot-sequence status labels below)
- QR code (rendered from `/api/recruit/qr` endpoint — returns a QR image or data URL)
- Training attendance % (if in training stage)

**Boot-sequence status labels per domain:**

| DB status | Displayed label |
|-----------|----------------|
| Registered, orientation not yet scanned | `POWER ON` |
| Orientation scanned | `SYSTEM CHECK: PASS` |
| Exam attended (at least 1 day scanned) | `DIAGNOSTIC RUNNING` |
| Shortlisted | `DIAGNOSTIC: PASS` |
| Not shortlisted | `DIAGNOSTIC: FAIL` |
| Interview done, result pending | `CALIBRATION` |
| Selected | `DEPLOYED` |
| In training | `RUNTIME — Day X / Y` |

**Access:** Requires `recruit_token` cookie. Middleware redirects to `/recruit/login` if missing.

#### `/recruit/logout`

Just clears `recruit_token` cookie and redirects to `/recruit/login`. Can be a server action or a simple `GET` route.

### Admin-Facing Pages (under `/dashboard/recruitment/*`)

These live inside the existing dashboard. Access requires existing `admin_token` with role `admin` or `lead`. Use `requireRole()` from `src/lib/session.ts` (existing helper) in every API route.

#### `/dashboard/recruitment`

**What:** Overview / landing page for the recruitment admin panel.

Shows:
- Active cycle name, year, total registrations
- Quick stats: registered / orientation / exam attended / shortlisted / interviewed / selected / in training
- Links to all sub-sections below

#### `/dashboard/recruitment/cycles`

**What:** Manage recruitment cycles.

Actions:
- View all cycles (name, year, is_active, created_at, closed_at, total_recruits)
- Create new cycle (name + year fields) → calls `POST /api/admin/recruitment/cycles`
- Close active cycle → calls `PATCH /api/admin/recruitment/cycles/:id/close`

Only `admin` role can create/close cycles. `lead` role can only view.

#### `/dashboard/recruitment/recruits`

**What:** Full list of registered recruits for active cycle.

Features:
- Table: Name, Reg No, Year, Department, Domain(s), Orientation ✓, Exam Day 1 ✓, Exam Day 2 ✓
- Filter by sub-domain, year, department
- Search by name or reg no
- Export as CSV → `GET /api/admin/recruitment/recruits/export`

#### `/dashboard/recruitment/marks`

**What:** Marks entry portal for evaluators.

Layout:
- Dropdown to select sub-domain (all six)
- After selecting domain: table of **every** recruit who selected that domain — *not* filtered by attendance (see [Exam & Shortlisting](#6-exam--shortlisting): marks entry is not gated by exam attendance)
- Columns: Name, Reg No, Year, Dept, Day 1 ✓/✗, Day 2 ✓/✗, Marks (editable number input 0–100), Save button per row
- The Day 1 / Day 2 ticks are scoped to the selected domain's exam, so they show whether the recruit sat *this* exam
- Shows existing marks if already entered

Calls: `POST /api/admin/recruitment/marks` (upsert)

**Domain filter note:** An evaluator can see and enter marks for all domains. No domain-level role restriction (the team is small enough that leads trust each other). If you want to restrict later, add a `domain` claim to the `admin_token` — but don't implement that now.

#### `/dashboard/recruitment/cutoffs`

**What:** Set shortlist cutoffs per domain.

- Simple form: one row for **each of the six domains**, number input for cutoff marks
- "Save Cutoffs" button → `POST /api/admin/recruitment/cutoffs`
- "Run Shortlist" button → `POST /api/admin/recruitment/shortlist/compute` — triggers auto-shortlist engine (see [Exam & Shortlisting](#6-exam--shortlisting))

#### `/dashboard/recruitment/shortlist`

**What:** View and manage shortlist across all domains.

**One table, no tabs** — the old "Portfolio Domains" tab was removed along with the portfolio track. Columns: Name, Reg No, Domain, Marks, Status, Method, Override. Filterable by domain and status.

Actions per row:
- Toggle status (shortlisted ↔ not_shortlisted) + optional override reason → `PATCH /api/admin/recruitment/shortlist/:id`, which sets `method = 'manual_override'`. The row must already exist (created by the compute engine) — the route 404s rather than inserting.

#### `/dashboard/recruitment/interview`

**What:** Interview day management. The most important page on interview day.

Layout — two panes:
1. **Left: Panel Manager** — shows all active panels for this cycle
   - "Add Panel" button → text input: "Panel name (e.g. Coding, SIESED)" → `POST /api/admin/recruitment/panels`
   - Each panel card shows: name, number of waiting / called / done tokens, "Close Panel" button
   - "Open Queue Display" link → opens `/dashboard/recruitment/interview/panel/[panelId]` in a new tab (the TV screen)

2. **Right: Panel Dashboard** — click on a panel to expand it:
   - Current queue (list of tokens: token number, recruit name, status)
   - "Call Next" button → `POST /api/admin/recruitment/panels/:panelId/call-next` → moves oldest `waiting` token to `called`, returns recruit profile + marks
   - Recruit profile card: Name, Reg No, Year, Dept, Domain(s), Exam marks, LinkedIn URL, domains they cleared
   - Result buttons: Selected / Rejected / Waitlisted → `POST /api/admin/recruitment/interview-results`, plus a domain picker ("Pick which domain this result is for")
   - Optional notes textarea
   - **Interview Results list** below, newest first, each row with a "Correct" button that re-posts to the same route to fix a mis-logged result

#### `/dashboard/recruitment/interview/panel/[panelId]`

**What:** Live queue display for a single panel. Designed to be shown on a TV or shared screen.

Shows:
- Panel name in large text
- "NOW SERVING: #X — [Name]" 
- Queue below: upcoming tokens (number + first name only)
- Auto-refreshes every 5 seconds (Supabase Realtime subscription OR polling — use Supabase Realtime `recruit_interview_tokens` channel for instant updates)

**Access:** Public — no auth required (it's a display screen, not sensitive). OR you can gate it behind `admin_token` if preferred.

#### `/dashboard/recruitment/training`

**What:** Training session management.

Actions:
- Create training sessions: Date + Label (e.g. "Week 1 — Day 1") → `POST /api/admin/recruitment/training-sessions`
- View all sessions, list recruits who attended each, attendance % per recruit
- Manual attendance toggle: mark a recruit present for a session → `POST /api/admin/recruitment/training-attendance/manual`

#### `/dashboard/recruitment/analytics`

**What:** Funnel metrics for the active cycle.

Shows:
- Bar chart or stat cards: Registered → Orientation → Exam → Shortlisted → Interviewed → Selected
- Breakdown per sub-domain
- Training attendance % per session
- Drop-off rate at each stage

This is read-only. All data from `GET /api/admin/recruitment/analytics`.

### API Routes

#### Auth (public)

| Method | Route | What |
|--------|-------|------|
| GET | `/api/recruit/auth/google` | Initiates Google OAuth redirect |
| GET | `/api/recruit/auth/google/callback` | Google OAuth callback — issues `recruit_token` or sets `recruit_oauth_state` |
| POST | `/api/recruit/auth/send-otp` | Sends OTP to SRM email |
| POST | `/api/recruit/auth/verify-otp` | Verifies OTP, updates `recruit_oauth_state` cookie |
| POST | `/api/recruit/auth/complete-registration` | Creates `recruit_accounts` + `recruit_domain_selections`, issues `recruit_token` |
| POST | `/api/recruit/auth/login` | SRM email + password login, issues `recruit_token` |
| POST | `/api/recruit/auth/logout` | Clears `recruit_token` |

#### Recruit-facing (requires `recruit_token`)

| Method | Route | What |
|--------|-------|------|
| GET | `/api/recruit/me` | Returns session recruit's profile + domain selections + pipeline status per domain |
| GET | `/api/recruit/qr` | Returns QR code as PNG data URL |

#### Admin — Cycles (requires `admin_token`, role `lead` or `admin`)

| Method | Route | What |
|--------|-------|------|
| GET | `/api/admin/recruitment/cycles` | List all cycles |
| POST | `/api/admin/recruitment/cycles` | Create new cycle (deactivates current active) |
| PATCH | `/api/admin/recruitment/cycles/:id/close` | Close a cycle |

#### Admin — Recruits

| Method | Route | What |
|--------|-------|------|
| GET | `/api/admin/recruitment/recruits` | List recruits for active cycle. Query params: `domain`, `year`, `search` |
| GET | `/api/admin/recruitment/recruits/export` | CSV export of recruits |

#### Admin — Marks

| Method | Route | What |
|--------|-------|------|
| GET | `/api/admin/recruitment/marks?domain=coding` | Get marks for a domain |
| POST | `/api/admin/recruitment/marks` | Upsert marks. Body: `{ recruit_id, sub_domain, marks }` |

#### Admin — Cutoffs + Shortlist

| Method | Route | What |
|--------|-------|------|
| GET | `/api/admin/recruitment/cutoffs` | Get cutoffs for all 6 domains (`cutoff_marks: null` if unset) |
| POST | `/api/admin/recruitment/cutoffs` | Set/update cutoffs. Body: `{ sub_domain, cutoff_marks }[]` |
| POST | `/api/admin/recruitment/shortlist/compute` | Run auto-shortlist engine across all 6 domains. Returns `{ computed, stats, skipped_domains }` |
| GET | `/api/admin/recruitment/shortlist` | Get all shortlist statuses for active cycle |
| PATCH | `/api/admin/recruitment/shortlist/:id` | Override a shortlist status. Body: `{ status, override_reason }` |

#### Admin — Interview

| Method | Route | What |
|--------|-------|------|
| GET | `/api/admin/recruitment/panels` | List panels for active cycle |
| POST | `/api/admin/recruitment/panels` | Create a panel. Body: `{ domain_label: string }` |
| PATCH | `/api/admin/recruitment/panels/:id/close` | Close a panel |
| PATCH | `/api/admin/recruitment/panels/:id/reopen` | Reopen a panel closed by mistake |
| GET | `/api/admin/recruitment/panels/:id/queue` | Get token queue for a panel |
| POST | `/api/admin/recruitment/panels/:id/call-next` | Mark oldest `waiting` token as `called`, return recruit profile. Compare-and-swap guarded |
| PATCH | `/api/admin/recruitment/panels/tokens/:tokenId/no-show` | Mark a `called` token as `no_show` |
| GET | `/api/admin/recruitment/interview-results` | List logged results for active cycle, newest first |
| POST | `/api/admin/recruitment/interview-results` | Log **or correct** a result. Body: `{ recruit_id, sub_domain, result, notes?, panel_id? }`. Upsert; recomputes `is_selected` |

#### Admin — Training

| Method | Route | What |
|--------|-------|------|
| GET | `/api/admin/recruitment/training-sessions` | List training sessions |
| POST | `/api/admin/recruitment/training-sessions` | Create a session. Body: `{ session_date, session_label }` |
| GET | `/api/admin/recruitment/training-attendance` | Get attendance for all sessions. Query: `session_id` |
| POST | `/api/admin/recruitment/training-attendance/manual` | Manual attendance. Body: `{ recruit_id, session_id }` |

#### Admin — Scanner (scan a recruit QR)

| Method | Route | What |
|--------|-------|------|
| POST | `/api/admin/recruitment/scan` | Process a QR scan. Body: `{ payload: string, mode: ScanMode, panel_id?: string }` — see [QR & Scanning](#5-qr--scanning) |

#### Admin — Analytics

| Method | Route | What |
|--------|-------|------|
| GET | `/api/admin/recruitment/analytics` | Returns funnel stats for active cycle |

---

## 5. QR & Scanning

Recruitment Module — QR & Scanning. This covers QR generation, payload format, HMAC signing, and the volunteer scanner page.

### QR Design Principles

- **One QR per recruit per cycle** — generated at registration, static until cycle closes
- **HMAC-signed** — cannot be spoofed by modifying a UUID
- **Mode-agnostic** — the same QR works for orientation, exam day 1, exam day 2, interview check-in, and all training sessions. The mode is set by the volunteer before scanning, not encoded in the QR
- **Self-contained** — scanner works offline after page load (no server call needed to decode the QR client-side — just verify HMAC)

### QR Payload Format

The QR encodes a URL-safe base64 string of a JSON object:

```ts
type QRPayload = {
  rid: string   // recruit_accounts.id (UUID)
  cid: string   // recruitment_cycles.id (UUID)
  sig: string   // HMAC-SHA256 of `rid:cid` using QR_SECRET env var, hex-encoded
}
```

Encoding:
```ts
import { createHmac } from 'crypto'

function signQR(rid: string, cid: string): string {
  const sig = createHmac('sha256', process.env.QR_SECRET!)
    .update(`${rid}:${cid}`)
    .digest('hex')
  return Buffer.from(JSON.stringify({ rid, cid, sig })).toString('base64url')
}

function verifyQR(payload: string): { rid: string; cid: string } | null {
  try {
    const { rid, cid, sig } = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    )
    const expected = createHmac('sha256', process.env.QR_SECRET!)
      .update(`${rid}:${cid}`)
      .digest('hex')
    if (sig !== expected) return null
    return { rid, cid }
  } catch {
    return null
  }
}
```

Place `signQR` and `verifyQR` in `src/lib/recruit-qr.ts` (new file).

The QR encodes the raw payload string (the base64url token), NOT a URL.

### QR Generation Endpoint

`GET /api/recruit/qr`

- Requires `recruit_token` cookie
- Calls `signQR(recruit_id, cycle_id)` using session values
- Renders a QR code as PNG using `qrcode` npm package:
  ```ts
  import QRCode from 'qrcode'
  const dataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 2 })
  ```
- Returns `{ qr_data_url: string, payload: string }` (payload so client can also show it as text if needed)

The student's dashboard renders `<img src={qr_data_url} />` directly. No download needed — volunteers scan the phone screen.

### Scanner Page: `/recruit-scanner`

This is a NEW page, completely separate from the existing `/scanner` (which handles workshop/event attendance via Google Sheets). Do NOT modify `/scanner`.

**Access:** Requires `admin_token` cookie (any role: `member`, `lead`, `admin` — all volunteers have at least `member`).

#### Scanner UI

The page has two main states:

**State 1 — Mode Selection (shown on load)**

Volunteer sees a mode picker before scanning:

```
Select scan mode:
○ Orientation
○ Exam — Day 1        (shows "Which exam?" domain dropdown)
○ Exam — Day 2        (shows "Which exam?" domain dropdown)
○ Interview Check-In  (shows panel dropdown)
○ Training            (shows session dropdown)

[Start Scanning]      ← disabled until the mode's extra selection is made
```

- **Exam modes** show a dropdown of all six sub-domains (grouped `SUBSYSTEM — Label`). Required, because attendance is recorded per exam.
- **Interview Check-In** shows active panels from `GET /api/admin/recruitment/panels?active=true`.
- **Training** shows sessions from `GET /api/admin/recruitment/training-sessions`, scoped to the active cycle.

Panels and training sessions are created *on the day*, often after a volunteer already has the page open, so both dropdowns re-fetch on mode switch and have a manual refresh button. Otherwise "No active panels found" would be a permanently stale answer.

**State 2 — Scanning Active**

Uses `html5-qrcode` npm package in the browser. Camera opens, decodes QR continuously.

On successful scan:
1. Client-side: decode QR payload from camera using `html5-qrcode`
2. Send to server: `POST /api/admin/recruitment/scan` with body `{ payload, mode, panel_id? }`
3. Show result card: success (name + message) or error (already scanned / invalid QR / not in cycle)
4. Scanner stays active for next scan — no page reload
5. Show a short beep/visual flash on scan (use `AudioContext` API for beep, CSS flash for visual)

"Change Mode" button always visible — brings back to State 1 without reloading page. A mode bar at the top always shows the active mode plus its selection (`Exam — Day 1 · SPACED — Coding`) so a volunteer can't drift into scanning the wrong domain unnoticed.

A `scanLockRef` suppresses duplicate decodes while a scan is in flight; the result card clears after 2.5s.

#### Recent scans + undo

The scanner keeps the last 10 successful scans **made on that device** in local state (lost on reload) with an Undo button per row, calling `DELETE /api/admin/recruitment/attendance` with `{ type, recruit_id, ... }`.

- Undo requires **lead or admin**. A `member` gets a 403 rendered as "Undo needs a lead or admin — ask a lead to undo this."
- The `recruit_id` is read client-side out of the QR payload's `rid` field. The signature can't be checked in the browser (`QR_SECRET` never ships), but the DELETE endpoint re-validates the recruit against the active cycle and requires lead/admin anyway.
- **Interview check-ins have no undo here** — removing someone from a live token queue is a queue operation, not an attendance delete, and belongs on the interview dashboard.

### Scan API: `POST /api/admin/recruitment/scan`

Requires `admin_token` cookie.

**Request body:**
```ts
{
  payload: string        // base64url QR payload from scanner
  mode: ScanMode
  sub_domain?: string    // REQUIRED if mode is exam_day_1 / exam_day_2
  panel_id?: string      // required only if mode === 'interview'
  session_id?: string    // required only if mode === 'training'
}

type ScanMode = 
  | 'orientation'
  | 'exam_day_1'
  | 'exam_day_2'
  | 'interview'
  | 'training'
```

**Server logic:**

```
1. verifyQR(payload) → if null → 400 "Invalid QR"
2. Check rid matches a recruit_accounts row → if not → 404 "Recruit not found"
3. Check cid matches current active cycle → if not → 400 "QR is from a different cycle"
4. Route to mode handler:

   orientation:
     - Check for existing row in recruit_orientation_attendance (rid, cid)
     - If exists → 200 { status: 'already_scanned', name }
     - Else → insert → 200 { status: 'ok', name, message: 'Orientation marked' }

   exam_day_1 / exam_day_2:
     - day = 1 or 2 (recorded, but NOT part of the row's uniqueness)
     - sub_domain required and must pass isRecruitSubDomain() → 400 otherwise
     - Verify the recruit actually selected this sub_domain → 400 otherwise
     - Check existing row in recruit_exam_attendance (rid, cid, sub_domain)
     - If exists → 200 { status: 'already_scanned', name,
                         message: '<Name> already scanned for the <Domain> exam (Day <n>)' }
       ...where <n> is the day of the ORIGINAL scan — so re-scanning on day 2 someone
       who was scanned on day 1 for the same domain correctly reports day 1.
     - Else → insert → 200 { status: 'ok', name, message: '<Domain> exam — Day X attendance marked' }

   interview:
     - panel_id required → validate it belongs to active cycle and is_active = true
     - Check existing row in recruit_interview_tokens (rid, panel_id)
     - If exists → 200 { status: 'already_checked_in', name, token_number }
     - Check recruit is shortlisted for at least one domain → if not → 400 'Not shortlisted'
     - Allocate token_number in a bounded (5-attempt) retry loop, NOT a plain
       read-max-then-insert. Two unique constraints can raise 23505 here and they
       mean different things — see the Interview Module section.
     - Return 200 { status: 'ok', name, token_number, panel_label }

   training:
     - session_id required → validate it belongs to active cycle
     - Check recruit is_selected = true → if not → 400 'Not a selected recruit'
     - Check existing row in recruit_training_attendance (rid, session_id)
     - If exists → 200 { status: 'already_scanned', name }
     - Else → insert (method: 'qr', marked_by: scanner username) → 200 { status: 'ok', name, session_label }
```

**Response shape (all modes):**
```ts
{
  status: 'ok' | 'already_scanned' | 'already_checked_in' | 'error'
  name: string
  message: string
  token_number?: number   // interview mode only
  panel_label?: string    // interview mode only
}
```

### Scanner Page Implementation Notes

Install `html5-qrcode`:
```
npm install html5-qrcode qrcode
```

Use dynamic import for the scanner component (it's browser-only):
```ts
const Html5QrcodeScanner = dynamic(() => import('@/components/recruit/Html5QrcodeScanner'), { ssr: false })
```

Create `src/components/recruit/Html5QrcodeScanner.tsx` as a client component (`'use client'`) that wraps `html5-qrcode`.

The scanner should:
- Request camera permission on mount
- Scan continuously
- On decode: call the parent `onScan(decodedText)` callback
- On error: log silently (don't show errors for every failed decode attempt — that's normal)

### Manual Backup (training only)

For training sessions, if a recruit's phone is dead or they forgot it, a lead can mark them present manually from `/dashboard/recruitment/training`. This calls `POST /api/admin/recruitment/training-attendance/manual` with `{ recruit_id, session_id }`. The row is inserted with `method: 'manual'` and `marked_by: <lead username>`. The `unique (recruit_id, session_id)` constraint prevents double-marking.

---

## 6. Exam & Shortlisting

Recruitment Module — Exam & Shortlisting. Covers exam attendance tracking, marks entry by evaluators, the cutoff engine, and manual overrides.

### One Shortlisting Path, All Six Domains

`coding`, `webdev`, `siesed`, `corporate`, `vfx_gfx`, `sambed` — every one of them runs:

```
written exam → QR attendance → evaluator enters marks → cutoff engine → shortlist status
```

There is **no portfolio-review track**. `webdev` and `vfx_gfx` were originally specced as manually-reviewed portfolio domains; that was removed on 2026-08-09 and this document has been updated to match the code. Concretely, if you are looking for them:

- `src/lib/recruit-domains.ts` no longer exports `EXAM_SUBDOMAINS`, `PORTFOLIO_SUBDOMAINS`, `isExamSubDomain`, or `isPortfolioSubDomain` — just `RECRUIT_SUBDOMAINS` / `RECRUIT_SUBDOMAIN_KEYS` / `isRecruitSubDomain`.
- The Shortlist page's "Portfolio Domains" tab is gone (it would be permanently empty). One table, no tabs.
- `method = 'portfolio'` is never written by any route. Only `'auto'` and `'manual_override'` occur.
- `portfolio_url` is a **LinkedIn URL collected from every recruit** at registration. The DB column name was kept to avoid a migration; nothing about it is domain-gated.

Leads who want a judgement call rather than a cutoff use the **override** path below — it works on any domain.

### Exam Attendance

Tracked via QR scan (see [QR & Scanning](#5-qr--scanning)). Rows land in `recruit_exam_attendance`.

**Attendance is per `(recruit, cycle, sub_domain)`, not per day.** Migration 001 made that the unique key. `day` (1 or 2) is still stored, and the marks table shows it as Day 1 / Day 2 ticks, but it is *not* part of the identity of the row. Consequences:

- A recruit who selected two domains is scanned **once per domain exam**, even if both exams fall on the same day. The volunteer picks the domain on the scanner before scanning.
- Scanning the same recruit for the same domain a second time returns `already_scanned` and reports which day the original scan was on — including when the re-scan is on the other day. This is correct, not a bug.

**Marks entry is NOT gated by exam attendance.** Evaluators can enter marks even if a recruit's QR wasn't scanned (e.g. scanner malfunction on the day). Attendance and marks are independent. However, the marks entry UI **shows** attendance status per recruit so evaluators know who physically sat the exam.

A recruit who did NOT attend either exam day can still have marks entered by the evaluator (evaluator's discretion). The shortlist engine treats zero-mark recruits normally — they get compared against the cutoff like everyone else.

The Day 1 / Day 2 ticks shown in the marks table are **scoped to the domain you are marking**, so they tell you whether the recruit sat *this* exam, not some other domain's.

### Marks Entry

#### UI Flow (`/dashboard/recruitment/marks`)

1. Lead selects sub-domain from dropdown (all six domains listed)
2. Page fetches: `GET /api/admin/recruitment/marks?domain=coding&cycle_id=<active>`
   - Returns all recruits who selected this domain, with their existing marks (if any) and exam attendance status (day 1, day 2 booleans)
3. Table renders:
   - Name | Reg No | Year | Dept | Day 1 ✓/✗ | Day 2 ✓/✗ | Marks (input) | Status (saved/unsaved)
4. Each row has a number input (0–100) and a "Save" button
5. Save → `POST /api/admin/recruitment/marks` → upserts the row

#### API: `POST /api/admin/recruitment/marks`

```ts
// Request
{
  recruit_id: string
  sub_domain: RecruitSubDomain   // any of the 6
  marks: number                  // 0–100 integer
}

// Server validations
// 1. Require admin_token (lead or admin) — NOT scoped to the lead's own domain
// 2. sub_domain must pass isRecruitSubDomain() → 400 otherwise
// 3. Verify recruit selected this sub_domain (check recruit_domain_selections)
//    → 400 'Recruit did not select this sub_domain'
// 4. marks must be an integer 0–100
// 5. Upsert recruit_marks on (recruit_id, sub_domain, cycle_id),
//    set evaluator_username from session, set updated_at = now()

// Response
{ saved: true, recruit_id, sub_domain, marks }
```

The upsert makes re-saving a correction safe. It also means two evaluators marking the same domain concurrently will overwrite each other — split the sheets by domain.

### Cutoff Engine

#### Setting Cutoffs

Route: `POST /api/admin/recruitment/cutoffs`

```ts
// Request — array, one entry per domain you want to set
[
  { sub_domain: 'coding', cutoff_marks: 60 },
  { sub_domain: 'webdev', cutoff_marks: 52 },
  { sub_domain: 'siesed', cutoff_marks: 55 },
  { sub_domain: 'corporate', cutoff_marks: 50 },
  { sub_domain: 'vfx_gfx', cutoff_marks: 54 },
  { sub_domain: 'sambed', cutoff_marks: 58 },
]

// Upserts recruit_cutoffs rows (unique on cycle_id, sub_domain)
```

`GET /api/admin/recruitment/cutoffs` always returns **all six** domains, with `cutoff_marks: null` for any not yet set, so the page can render every row up front.

Cutoffs can be set and updated at any time before or after marks entry. Running the shortlist engine after updating a cutoff recomputes all statuses.

#### Running the Engine

Route: `POST /api/admin/recruitment/shortlist/compute`

This is a server-side batch operation. It:

1. Fetches active cycle ID
2. For each of the six domains: fetch cutoff from `recruit_cutoffs`
3. For each recruit who selected that domain: fetch their marks from `recruit_marks`
4. Compute: `marks >= cutoff_marks` → `shortlisted` / `not_shortlisted` / `pending` (no marks yet)
5. Upsert into `recruit_shortlist_status`:
   - `status`: as above
   - `method`: `'auto'`
   - `computed_at`: now()
   - DO NOT overwrite rows where `method = 'manual_override'` — skip those

```ts
// Pseudocode
for (const domain of RECRUIT_SUBDOMAIN_KEYS) {
  const cutoff = await getCutoff(domain, cycleId)
  const recruits = await getRecruitsByDomain(domain, cycleId)
  
  for (const recruit of recruits) {
    const marksRow = await getMarks(recruit.id, domain, cycleId)
    
    // Skip manual overrides
    const existing = await getShortlistStatus(recruit.id, domain, cycleId)
    if (existing?.method === 'manual_override') continue
    
    const status = !marksRow 
      ? 'pending' 
      : marksRow.marks >= cutoff.cutoff_marks 
        ? 'shortlisted' 
        : 'not_shortlisted'
    
    await upsertShortlistStatus({
      recruit_id: recruit.id,
      sub_domain: domain,
      cycle_id: cycleId,
      status,
      method: 'auto',
      computed_at: new Date()
    })
  }
}

return { computed: true, stats, skipped_domains }
```

**Run it as many times as needed** — it's idempotent for non-overridden rows.

Two details the pseudocode glosses over:

- Overridden rows are skipped from the *write*, but their status is still counted into the returned `stats`, so "Run Shortlist" reports the full current picture rather than only what it just wrote.
- Domains with no cutoff are collected into `skipped_domains` and returned to the caller; the batch does not fail.

### Manual Override

Any single decision, in any domain, can be overridden by a lead — this is the escape hatch that replaced the portfolio-review path.

#### UI Flow (`/dashboard/recruitment/shortlist`)

One table for all domains (no tabs). Columns: Name | Reg No | Domain | Marks | Status | Method | Override. Filterable by domain and by status.

#### API: `PATCH /api/admin/recruitment/shortlist/:id`

`:id` is the `recruit_shortlist_status` row id. The row must already exist — the compute engine creates it before the page renders an override button, so **run the engine before expecting to override anything**.

```ts
// Request
{
  status: 'shortlisted' | 'not_shortlisted'   // anything else → 400
  override_reason?: string                     // optional note
}

// Server
// 1. Require admin_token (lead or admin)
// 2. Fetch existing shortlist_status row by id → 404 if missing (it does NOT insert)
// 3. Update:
//    status         → from body
//    method         → 'manual_override'   (always; there is no 'portfolio' method)
//    override_reason → from body
//    overridden_by  → session username
//    overridden_at  → now()
```

Once a row is `manual_override`, re-running the compute engine will never change it again — including if the marks or the cutoff later change. Fixing a bad override means overriding it back by hand.

### Shortlist Status View

Route: `GET /api/admin/recruitment/shortlist`

Returns all `recruit_shortlist_status` rows for active cycle, joined with recruit name, reg_no, domain selections, and marks. Query param `?domain=coding` filters by domain. Query param `?status=shortlisted` filters by status.

### Edge Cases

**Recruit applies for 2 domains (e.g. coding + webdev):**
- Sits both exams, scanned once for each, gets a `recruit_marks` row per domain
- Gets a `recruit_shortlist_status` row per domain, compared against that domain's own cutoff
- Can be shortlisted for both, one, or neither independently
- At interview they are checked into one panel per scan — see [Interview Module](#7-interview-module). Interview panels are free-text labels, not `sub_domain` values, so nothing links a token to a specific domain.

**No marks entered for a recruit:**
- `recruit_marks` has no row for them
- Engine sets their status to `pending` (not `not_shortlisted`)
- They don't appear in the interview check-in as shortlisted
- Admin can manually override if needed

**Cutoff not set for a domain:**
- Engine skips that domain entirely — nobody in it gets a status row at all
- The domain is listed in the response's `skipped_domains`
- Set all six cutoffs before running the engine

**Marks updated after engine runs:**
- Just re-run the engine — it recomputes all non-overridden rows

---

## 7. Interview Module

Recruitment Module — Interview Module. Covers walk-in interview flow, panel creation, the live queue, result logging, and real-time updates.

### Design Philosophy

Interviews are walk-in — no time slots, no pre-booking. On interview day:

1. Lead opens `/dashboard/recruitment/interview`
2. Clicks "Add Panel", types a domain name (e.g. "Coding") → panel is live instantly
3. Recruits walk in, volunteer scans their QR in "Interview Check-In" mode
4. System adds recruit to the correct panel queue, gives them a token number
5. Panel interviewer clicks "Call Next" → sees recruit's full profile
6. Logs result → next recruit

The system is intentionally flexible — panel names are free text typed on the day, not pre-configured. Multiple panels can run simultaneously.

### Panel Creation

#### UI (`/dashboard/recruitment/interview` — left pane)

```
[+ Add Panel]

When clicked:
  Input: "Panel name (e.g. Coding, SIESED, Web Dev)"
  [Create]

Active Panels:
  ┌─────────────────────────────────────────────────────┐
  │ Coding      ●  Waiting: 3   Called: 1   Done: 7     │
  │ [Open Queue Display ↗]  [Close Panel]               │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │ SIESED      ●  Waiting: 5   Called: 0   Done: 4     │
  │ [Open Queue Display ↗]  [Close Panel]               │
  └─────────────────────────────────────────────────────┘
```

#### API: `POST /api/admin/recruitment/panels`

```ts
// Request
{ domain_label: string }   // free text, 1–50 chars

// Server
// 1. Require admin_token (lead or admin)
// 2. Get active cycle_id
// 3. Insert recruit_interview_panels { cycle_id, domain_label, is_active: true, created_by: session.username }
// 4. Return { panel_id, domain_label, created_at }
```

#### API: `PATCH /api/admin/recruitment/panels/:id/close`

Sets `is_active = false` on the panel. Any remaining `waiting` tokens are left as-is (admin can see them but no more recruits can be added). Returns `{ closed: true }`.

`PATCH /api/admin/recruitment/panels/:id/reopen` reverses it, for a panel closed by mistake.

### Interview Check-In (QR Scan)

When volunteer scans in "Interview Check-In" mode, they first select which panel from the active panels dropdown, then start scanning.

On each scan, the server-side scan handler (see [QR & Scanning](#5-qr--scanning)) does:

1. Verify QR HMAC
2. Look up recruit in `recruit_accounts`
3. Verify recruit is shortlisted (`recruit_shortlist_status.status = 'shortlisted'`) for at least one domain
4. Check if recruit already has a token for this panel → if yes, return token number (idempotent)
5. Get next token number for this panel
6. Insert `recruit_interview_tokens` row

**Token allocation is a retry loop, not a plain read-max-then-insert.** There are two unique constraints on the table: `(recruit_id, panel_id)` — a genuine duplicate check-in — and `(panel_id, token_number)`, added by migration 003 as a backstop for the allocation race. A naive handler that assumes any `23505` is the first constraint will silently report "already checked in" to the *second* of two recruits scanned into the same panel at nearly the same instant, dropping their check-in. The handler distinguishes the two causes and retries (bounded, 5 attempts) only on a real token collision.

⚠️ This has been verified by reading the constraint logic, **not** by hitting it with real concurrent traffic. Until it's load-tested, run one check-in device per panel.

**If a recruit is shortlisted for 2 domains, do they get tokens for both panels?**
The scanner adds them to ONE panel per scan (whichever panel the volunteer selected). If the recruit wants to be in both panels, the volunteer scans them twice, selecting a different panel each time. This is intentional — the recruit physically goes to one interview at a time.

### Panel Dashboard (right pane of interview page)

Click on a panel card in the left pane to expand its dashboard on the right.

#### Fetch Queue

`GET /api/admin/recruitment/panels/:panelId/queue`

Returns all tokens for this panel, ordered by `token_number ASC`. Every child query is itself ordered by `sub_domain`, so `domains`, `exam_marks` and `shortlisted_for` come back in a stable order — the panel dashboard uses `shortlisted_for[0]` as its default domain selection and unordered Postgres output made that flap between reloads.

```ts
[
  {
    token_id: string
    token_number: number
    status: 'waiting' | 'called' | 'done' | 'no_show'
    recruit: {
      id: string
      name: string
      reg_no: string
      year: string
      department: string
      domains: string[]          // their selected sub_domains
      exam_marks: { sub_domain: string; marks: number }[]   // empty if no marks entered yet
      portfolio_url?: string     // LinkedIn URL — collected from every recruit, see section 6
      shortlisted_for: string[]  // which domains they cleared
    }
    checked_in_at: string
    called_at?: string
  }
]
```

#### Call Next

`POST /api/admin/recruitment/panels/:panelId/call-next`

```ts
// Server logic:
// 1. Find oldest token where status = 'waiting', ordered by token_number ASC
// 2. If none → 200 { status: 'queue_empty' }
// 3. Set status = 'called', called_at = now()
// 4. Return the full token + recruit profile (same shape as queue item above)
```

The interviewer now sees the full recruit profile on screen.

#### Log Result

`POST /api/admin/recruitment/interview-results`

```ts
// Request
{
  recruit_id: string
  sub_domain: string          // which domain this result is for
  result: 'selected' | 'rejected' | 'waitlisted'
  notes?: string
}

// Server
// 1. Require admin_token (lead or admin)
// 2. Get active cycle_id
// 3. Upsert recruit_interview_results on (recruit_id, sub_domain, cycle_id)
// 4. Find the recruit_interview_tokens row for this recruit + panel → set status = 'done'
// 5. RECOMPUTE recruit_accounts.is_selected — see below
// 6. Return { saved: true }
```

**Logging result auto-marks the token as `done`.** No separate "done" button needed.

**This route doubles as the edit path.** The upsert on `(recruit_id, sub_domain, cycle_id)` overwrites an existing decision, so re-posting a corrected result fully reverses a mistake. The panel page exposes this as a "Correct"/"Fix" button on the Interview Results list — don't re-scan a recruit to fix their result.

**`is_selected` is recomputed, not set.** Step 5 re-queries whether *any* result for this recruit in this cycle is `'selected'` and writes that boolean. An earlier version just set `is_selected = true` on a selected result, which meant correcting a mistaken `selected` → `rejected` left the recruit permanently flagged as selected (and still able to scan into training). The recompute runs after **every** result write, in both the create and the correct path, so it flips back to `false` correctly.

**Selecting for multiple domains:** If a recruit passed interviews for 2 domains, they get 2 `recruit_interview_results` rows. Both can have `result = 'selected'`. `is_selected` is `true` while at least one of them is `selected`.

Note that `recruit_accounts.is_selected` means "this person joined the team", **not** "this person passed every domain they applied to". The recruit's own dashboard deliberately does not consult it when deciding per-domain status — only an interview result logged against *that* `sub_domain` counts — otherwise a recruit rejected in one domain would see `DEPLOYED` against it.

### Live Queue Display (`/dashboard/recruitment/interview/panel/[panelId]`)

This is the TV/projector screen for the waiting area.

#### What it shows

```
┌────────────────────────────────────────────────┐
│                  CODING PANEL                  │
│                                                │
│           NOW SERVING                          │
│               #12 — Arjun S.                  │
│                                                │
│  NEXT UP:                                      │
│  #13  #14  #15  #16  #17                      │
└────────────────────────────────────────────────┘
```

- "NOW SERVING" = the `called` token (there should be only one per panel at a time)
- "NEXT UP" = next 5 `waiting` tokens by number
- If no `called` token: show "Waiting for next call..."

#### Real-Time Updates

**As built: 3-second polling** — `setInterval(fetchQueue, 3000)`. The Supabase Realtime approach below was specced but not implemented; it remains a valid upgrade if polling ever becomes a problem, and would need Realtime toggled on for `recruit_interview_tokens` in the Supabase dashboard.

```ts
const channel = supabase
  .channel(`panel-queue-${panelId}`)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'recruit_interview_tokens', filter: `panel_id=eq.${panelId}` },
    (payload) => {
      // Re-fetch queue on any change
      fetchQueue()
    }
  )
  .subscribe()
```

Since `recruit_interview_tokens` uses service-role for writes (no public policy), you need to enable Realtime on the table in Supabase dashboard: Table Editor → `recruit_interview_tokens` → Realtime toggle ON. The channel subscription here uses the anon key (just listening, not writing) which is fine for display purposes — no sensitive data is exposed (only token number + first name + called status).

#### Recruit-Facing Queue Position

A recruit with an active (`waiting`/`called`) token also sees their own position on `/recruit/dashboard`. `GET /api/recruit/me` returns an `interview: { panel_label, token_number, status, waiting_ahead }` field, with `waiting_ahead` computed as a `count`-only query so no other recruit's identity is ever exposed.

- The dashboard card polls every 10s, but **only while a token is active** — it stops once the token resolves.
- If a recruit holds tokens on two panels at once, a `called` token is shown in preference to a merely `waiting` one.

#### Access

No `admin_token` required — this page is meant to be cast to a TV. Make it public. The data shown (token numbers + first names) is not sensitive.

### No-Show Handling

If a recruit's token was `called` but they never showed up, the interviewer can mark them as no-show. This should be a button in the panel dashboard: "No Show" on a `called` token.

Route: `PATCH /api/admin/recruitment/panels/tokens/:tokenId/no-show`
- Sets token status to `no_show`
- Does NOT create an `interview_results` row (they didn't interview)
- Panel dashboard then allows calling the next `waiting` token

#### Auto no-show (self-healed inline, not a cron)

Only one token per panel can be `called` at a time, so a volunteer who calls someone and then forgets to resolve them would otherwise block that panel's Call Next indefinitely.

There used to be a `POST /api/admin/recruitment/interview-auto-noshow` cron (`CRON_SECRET` bearer auth, scheduled every 5 minutes in `vercel.json`) that swept stale `called` tokens. That schedule exceeds Vercel Hobby's once-per-day cron cap and would fail to deploy on a free plan, so it was replaced: `findCalled()` in `src/app/api/admin/recruitment/panels/[id]/call-next/route.ts` now checks the existing `called` token's age itself, and if it's older than `NO_SHOW_TIMEOUT_MINUTES` (15), flips it to `no_show` (CAS-guarded) before falling through to call the next waiting token. No standalone route, no cron, no `src/proxy.ts` carve-out needed.

Tradeoff: a stuck token only clears the next time someone hits Call Next on that panel, not proactively in the background. Nothing depends on it clearing sooner than that.

### Concurrent Panels

Multiple panels run in parallel — each has its own independent queue and token number sequence. The scanner lets the volunteer choose which panel before scanning. The panel dashboard on `/dashboard/recruitment/interview` shows all panels side by side (or tab-switched on smaller screens).

**There is no load balancing across panels.** The volunteer manually picks the panel, so two panels running the same domain can drift badly out of balance. Auto-routing to the shortest queue was discussed and deliberately deferred — it would change the manual-selection flow volunteers rely on, so it needs a design pass rather than a quick patch. In the meantime, watch queue lengths and redirect the line by hand.

`POST .../call-next` uses a compare-and-swap guard so two interviewers clicking Call Next simultaneously can't both be handed the same recruit. Like the token-allocation retry, this has not been load-tested against real concurrent traffic.

### End of Interview Day

1. Lead closes all panels (`PATCH .../close`)
2. View full results in the Interview Results list on `/dashboard/recruitment/interview` — every recruit with their result per domain, newest decision first, each with a Correct button
3. Nothing to do for `is_selected` — the interview-results route recomputes it on every write

After interview day, selected recruits' dashboards show `DEPLOYED` status. Training sessions can then be created at `/dashboard/recruitment/training`.

---

## 8. Known Gaps / History

This section preserves the session-handoff notes (`summary.md`), covering what's built, what's broken, and what's pending as of 2026-08-09.

There is also a non-technical operational playbook for volunteers and leads: `Recruitment-Playbook.pdf` (source: generated HTML, not checked in).

### Migrations applied (2026-08-09)

All three pending migrations are now live on Supabase, applied via the `mcp__supabase__apply_migration` MCP tool (it was authenticated by this session — the earlier note about it being unavailable no longer applies):

1. `supabase/recruit-migration-001-exam-subdomain.sql` — applied with one addition: two seeded recruits had duplicate exam-attendance rows (day 1 + day 2 for the same domain) that collided under the new `(recruit_id, cycle_id, sub_domain)` unique key. The migration file was patched with a pre-flight dedup step (keep earliest scan, drop the rest) before applying — that patch is now permanently in the file, so re-running it elsewhere is still safe.
2. `supabase/recruit-migration-002-cycles-training.sql` — applied (no-op on this DB's data: 0 training sessions, 1 active cycle already).
3. `supabase/recruit-migration-003-interview.sql` — applied (no-op: 0 interview tokens existed yet).

Verified: `recruit_email_otps.attempts` now exists and reads `0`. OTP verification during registration should work again.

### Domain model change (2026-08-09): all 6 domains are now exam domains

Webdev and VFX/GFX used to be "portfolio" domains (no written exam, manually reviewed instead of cutoff-computed). Per explicit user instruction, that distinction is gone: **all six sub-domains now run the identical exam → cutoff-computed-shortlist pipeline.** Concretely:

- `src/lib/recruit-domains.ts` no longer has a `method: "exam" | "portfolio"` field, nor `EXAM_SUBDOMAINS`/`PORTFOLIO_SUBDOMAINS`/`isExamSubDomain`/`isPortfolioSubDomain`. Just `RECRUIT_SUBDOMAINS`/`RECRUIT_SUBDOMAIN_KEYS`/`isRecruitSubDomain` now — every consumer (scanner, cutoffs, marks, shortlist, analytics, `me` route, `scan` route) was updated to match.
- The Shortlist admin page's "Portfolio Domains" tab was removed entirely (it would have been permanently empty) — one table, no tabs.
- `portfolio_url` (DB column name kept as-is, no migration needed) is now a **LinkedIn URL required from every recruit at registration**, not a domain-gated portfolio link. UI labels say "LinkedIn" now; the wire/DB field name is unchanged.
- `scripts/seed-recruitment.ts` was updated to match (exam attendance/marks/cutoffs now generated for webdev/vfx_gfx too, LinkedIn URL for everyone) — **but the currently-seeded 60 recruits predate this change**: their webdev/vfx_gfx selections have no exam attendance, marks, or cutoff data, because they were seeded under the old portfolio-only model. Re-run `npm run seed:recruitment -- --yes` for a dataset consistent with the new model if you need one for testing (it wipes and re-seeds the active cycle).

### What's built

A full recruitment pipeline bolted onto the existing site: Google OAuth + SRM OTP registration → orientation/exam QR attendance → marks entry + auto-shortlist by cutoff → walk-in interview queue with panels → training session attendance → analytics. (See domain model change above — there is no separate manual-portfolio-review path anymore.)

**Student-facing**: `/recruit/register`, `/recruit/login`, `/recruit/dashboard` (status page + QR + CSS lanyard badge), `/recruit/logout`.

**Volunteer**: `/recruit-scanner` — mode picker (orientation / exam day 1 / exam day 2 / interview check-in / training), with per-exam-domain selection, live undo of the last 10 scans, auto-refreshing panel/session dropdowns.

**Admin** (`/dashboard/recruitment/*`): overview, cycles (create/close/**activate**, atomic via a partial unique index so only one cycle can ever be active), recruits roster + CSV export + department filter, marks entry, cutoffs + shortlist-compute engine, shortlist review (single table, all domains — no more exam/portfolio tab split), interview day (panels, live queue, call-next with compare-and-swap, results list with correction/"Fix" button), training (sessions, QR + manual attendance, delete-session), analytics (funnel, per-domain breakdown, training %).

**Shared domain model**: `src/lib/recruit-domains.ts` is the single source of truth for the 6 sub-domains and their parent subsystems — SPACED (Coding, Web Dev), SIESED, MCSOCD (Corporate, VFX/GFX), SAMBED. Every page/route imports from here; nothing hardcodes the domain list anymore.

**Auth/security hardening already done**: OAuth `state` param (was vulnerable to account-fixation), `portfolio_url` XSS guard (http/https-only, checked at write AND render), OTP brute-force cap (5 attempts) + `crypto.randomInt` instead of `Math.random`, Google-step-cannot-be-skipped enforcement, login timing-oracle fix (dummy bcrypt compare), fail-closed `RECRUIT_JWT_SECRET`/`QR_SECRET` in production, registration-status-oracle fix on `send-otp`.

**Seed data**: `npm run seed:recruitment -- --yes` (or already run — check row counts) populates 60 realistic recruits across all 6 domains including 15 multi-domain recruits (the deliberately tricky case). Test password for all seeded recruits: `Test@1234`. Idempotent — safe to re-run, deletes and re-inserts only the active cycle's recruit data. Active cycle right now: **"Reqruitment 2026" (2026-27)**, 60 recruits already seeded.

### Other fixes this session (2026-08-09)

- **Google OAuth login silently bounced to `/recruit/login` with no error.** Root cause: `RECRUIT_COOKIE_OPTIONS` and `OAUTH_STATE_COOKIE_OPTIONS` in `src/lib/recruit-session.ts` used `sameSite: "strict"`, but both are set on redirect responses *inside* the Google OAuth callback — a navigation chain that started as a cross-site redirect from `accounts.google.com`. Browsers evaluate SameSite over the whole redirect chain, so a `strict` cookie set mid-chain can get silently dropped even on the very next same-origin hop. Fixed by switching both to `sameSite: "lax"` (same protection level as the `OAUTH_NONCE_COOKIE`, which already used `lax` for exactly this reason). Also added: a UI error message for the `google_state_mismatch` case (was previously silent) and a server-side `console.warn` on that path.
- **LanyardBadge visual/UX pass**: shrank the strap (was ~2x taller than needed), enlarged the strap-tiled logos and the badge-header logo, and moved the drag/click pointer handlers from just the small card onto the whole pendulum (strap + clip + card) — previously only the card was interactive, but the strap is what a user's eye is drawn to grab.
- **LanyardBadge flickering scrollbar**: `.lanyard-badge-scene` had `overflow-x: hidden; overflow-y: visible`. Per the CSS overflow spec, that combination forces `overflow-y` to compute to `auto`, not `visible` — and since the pendulum continuously rotates via the idle-sway animation, its scrollable-overflow bounds toggled in and out of the container's box every cycle, flickering a real vertical scrollbar. Confirmed via `getComputedStyle` and by sampling `scrollHeight` over time before/after. Fixed: `overflow: hidden` on both axes (the swing's vertical extent barely changes at these rotation angles, so nothing is visibly clipped).

### Walk-in interview module improvements (2026-08-09)

Three changes, built in parallel by background agents and independently verified afterward (code review + a fresh `tsc --noEmit` + live functional tests against real seeded recruit rows via the Supabase MCP, not just each agent's own self-report):

1. **Token-number race fixed** (`src/app/api/admin/recruitment/scan/route.ts`, `case "interview":`). Token numbers were allocated read-max-then-insert, and on a `23505` the old code always assumed the `(recruit_id, panel_id)` unique constraint fired (genuine duplicate check-in). It didn't account for the OTHER unique constraint, `(panel_id, token_number)` — added by migration 003 as a backstop for exactly this race — which fires when two different recruits get scanned into the same panel close together. That case was being silently misreported as "already checked in" for the second recruit, dropping their check-in entirely. Now wrapped in a bounded (5-attempt) retry loop that distinguishes the two causes and only retries on the real token collision. Verified by reading the constraint logic directly — not yet hit with actual concurrent traffic (that's still a real gap, see below).

2. **Recruit-facing live queue position** (`GET /api/recruit/me` + `/recruit/dashboard`). A recruit with an active (`waiting`/`called`) `recruit_interview_tokens` row now gets an `interview: { panel_label, token_number, status, waiting_ahead }` field, computed via a `count`-only query (never exposes other recruits' identities) — and a live card on their dashboard ("You're #3 — 2 ahead of you" / a pulsing "You're being called now" state), polling every 10s but **only** while a token is active (stops once resolved). If a recruit has tokens on two panels at once (possible when shortlisted for 2 domains), a `called` token is shown in preference to a merely `waiting` one elsewhere — verified live: inserted a `waiting` token on one test panel and a `called` token on another for the same test recruit, confirmed the API returned the `called` one.

3. **Auto no-show cron endpoint** (`POST /api/admin/recruitment/interview-auto-noshow`). If a volunteer calls a recruit and forgets to resolve them to `done`/`no_show`, that panel's Call Next can never advance (only one `called` token per panel at a time). This endpoint flips any `called` token older than 15 minutes (`NO_SHOW_TIMEOUT_MINUTES`) to `no_show`, scoped to the active cycle. Auth mirrors the existing `src/app/api/attendance/auto-checkout/route.ts` precedent — a `CRON_SECRET` bearer token, not the staff `admin_token` cookie. **Verified live**: seeded a stale (20-min-old) `called` token and a fresh one, ran the endpoint, confirmed only the stale one flipped. **⚠️ Not wired to an actual scheduler yet** — nothing calls this periodically. Needs a Vercel Cron / GitHub Actions job (or similar) hitting it every few minutes during a real interview day, same as `auto-checkout` presumably already has (not verified either way — check before relying on this).

   **Also required a `src/proxy.ts` change**: `/api/admin/:path*` normally requires the `admin_token` staff cookie, which a cron caller sending only the `CRON_SECRET` bearer header doesn't have. Added a one-line carve-out (mirroring the existing `/api/admin/login` exception, which needs the same treatment since it's the route that *issues* that cookie) so this specific path skips the cookie gate — the route still has its own `CRON_SECRET` check, so this doesn't weaken auth, it just moves which layer enforces it. Verified end-to-end against the live dev server: no `Authorization` header → 401 from the route (not middleware's generic message, confirming the carve-out reaches the handler); correct bearer token → 200.

**Not built** (discussed but deliberately deferred, needs a UX decision, not a quick patch): load-balancing recruits across multiple panels for the same domain. Right now a volunteer manually picks which panel to scan a recruit into; auto-routing to the panel with the shortest queue would need to change that manual-selection flow, which volunteers currently rely on — worth a deliberate design pass before touching it, not a "finish it fast" addition.

### Known remaining gaps (not fixed yet)

- **Concurrency edges not fully load-tested**: `call-next` has a compare-and-swap guard, and the interview check-in token-number race now has a retry loop (see above) — but neither has been hit with real concurrent traffic yet. Worth a real load test (or at least a multi-tab manual test) before relying on it during an actual interview day with multiple scanners on one panel.
- **No automated tests** — this whole module was built and verified via `tsc --noEmit`, `npm run build`, and manual Playwright browser smoke tests (screenshots, not a persisted test suite). If you want CI coverage, there is none yet.
- Haven't independently re-verified every fix three background agents reported mid-flight after a session-limit kill (see "Recovery notes" below) — they self-reported completion but a fresh pass wouldn't hurt.

### Recovery notes (context you might need)

Partway through the security/correctness fix pass, the session hit its usage limit and killed three background agents mid-task. On resume, `tsc --noEmit` was clean and all their planned new files existed, so they got further than their kill point suggested — but this wasn't independently re-audited file by file, just spot-checked (cycles activate button, scanner undo, interview results list — all confirmed present and wired).

**Unrelated concurrent changes**: while this work was happening, something else (shadcn/ui `init`, evidenced by `components.json` appearing) was also touching this repo — it overwrote `src/lib/utils.ts` and dropped a `formatDate` export that 4 unrelated pages depended on, breaking the build. That was restored additively. Also present in the working tree but **not part of the recruitment work**: `src/components/Lightning.tsx`, `public/intro.mp4`, changes to `src/app/globals.css` / `layout.tsx` / `page.tsx` / `RecruitmentSection.tsx` — these are someone else's in-progress changes (likely a landing-page visual refresh), don't assume they're related to or break the recruitment module, and don't revert them without checking with the user first.

### Reactbits Lanyard — do not re-attempt the 3D version

The user asked for the reactbits.dev "Lanyard" component (physics-simulated 3D badge). It was built and installed (`@react-three/fiber` v8, `@react-three/drei`, `@react-three/rapier`, `meshline`, `three`) but **crashes at runtime** with `Cannot read properties of undefined (reading 'ReactCurrentOwner')` — a documented incompatibility between `@react-three/fiber` v8's `react-reconciler` and React 18.3.1 (this project's version). Confirmed reproducible in both dev and production builds; `transpilePackages` in `next.config.js` did not fix it. The only real fixes are downgrading React project-wide or jumping to React 19 (which fiber v9 requires) — both far riskier than a badge widget justifies, so those packages were **uninstalled**.

What's live instead: `src/components/recruit/LanyardBadge.tsx`, a pure CSS/React component (no WebGL) — a strap tiled with the team logo, a swinging pendulum animation, hover-tilt on the card, showing a composited badge image (`src/components/recruit/generateBadgeImage.ts` draws logo + QR + name onto a canvas). This is the intended permanent solution, not a stopgap — don't reintroduce the r3f stack unless the project's React version changes.

### File map

- `supabase/recruit-schema.sql` — full current schema (already reflects all 3 pending migrations — it's the target state, not what's live)
- `supabase/recruit-migration-00{1,2,3}-*.sql` — the pending migrations, apply in order
- `src/lib/recruit-domains.ts` — domain/subsystem source of truth
- `src/lib/recruit-session.ts`, `recruit-qr.ts`, `recruit-validation.ts` — shared recruit-auth/QR/validation helpers
- `src/lib/supabase/recruit-admin.ts` — untyped service-role client for `recruit_*` tables (the generated `Database` type doesn't know about them)
- `src/app/api/recruit/**` — student-facing API (auth, me, qr)
- `src/app/api/admin/recruitment/**` — staff-facing API (~21 routes)
- `src/app/recruit/**`, `src/app/recruit-scanner/**` — student pages + scanner
- `src/app/dashboard/recruitment/**` — admin pages
- `scripts/seed-recruitment.ts` — seed data generator
