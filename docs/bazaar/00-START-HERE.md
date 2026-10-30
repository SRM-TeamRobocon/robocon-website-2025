> Preserved planning/discovery reference. Read [README.md](README.md) for current scope and use AGENTS.md for current UI rules. Do not rerun historical setup steps automatically.

# Bazaar: Start Here

An inventory + component-request section for the **existing dashboard** of the SRM Team Robocon website
(`robocon-website-2025`: Next.js App Router, Supabase, Tailwind).

> Display name: **"Siesed Bazaar"** (single constant `BAZAAR_NAME`, easy to rename).

## Scope

**In scope:** inventory, component requests, approvals, handover, returns, reminders, audit log.
**Out of scope:** everything about authentication. Login/accounts already exist and are reused as-is.
Cline must not build or modify any auth, signup, profile, or verification feature.

## What it does

1. **Leads** keep the component inventory (name, category, quantity, location, photo).
2. Any logged-in **member** browses components and submits a request: component, quantity, purpose,
   **date of taking**, **expected return date**.
3. A **lead approves or rejects**. Approval reserves the stock.
4. The lead marks it **issued** at handover and **returned** when it comes back (good / damaged / lost units).
5. Emails go out at each step; overdue returns are flagged and reminded automatically.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Authentication | Already done. Reused via one adapter file (`src/lib/bazaar/auth.ts`) |
| Approver | **Leads only** (desk or other staff roles, if present, are read-only on management views) |
| Inventory tracking | **By quantity** (e.g. 20 resistors) |
| Where it lives | A new "Siesed Bazaar" entry in the existing dashboard, with role-aware tabs |
| Look and feel | **Must match the existing dashboard theme exactly** (see `.clinerules/bazaar.md` section 3) |

## Assumptions (tell me if any are wrong)

1. **One item per request** in v1 (multi-item cart is a v2 idea).
2. Stock is **reserved on approval**, not on request.
3. Max **5 active requests** per member (pending + approved + issued) and max **30 days** per loan (configurable).
4. "Overdue" is **derived** (status `issued` and expected return date before today in IST), not stored.
5. The existing auth exposes, for the logged-in user, at least an id and a name (email and registration number are
   used if available). Phase 0 confirms this. If something is missing, Cline stops and asks; it does **not** add profile features.

## Files in this pack

| File | Purpose |
|---|---|
| `.clinerules/bazaar.md` | Standing rules Cline follows (scope, theme, security, workflow) |
| `docs/bazaar/00-START-HERE.md` | This file |
| `docs/bazaar/01-requirements.md` | Roles, flows, status machine, business rules, edge cases |
| `docs/bazaar/02-database.md` | Full SQL (tables, stock functions) + verification queries |
| `docs/bazaar/03-api-spec.md` | Endpoints, payloads, error codes, cron |
| `docs/bazaar/04-ui-spec.md` | Pages and components (theme-matched) |
| `docs/bazaar/05-implementation-plan.md` | Phases with copy-paste prompts + test matrix |

## How to use with Cline

1. Copy `.clinerules/` and `docs/` into the **root of your repo**.
2. `git checkout -b feature/bazaar`
3. Open in VS Code with Cline, start in **Plan Mode**, paste the **Phase 0 prompt** from `05-implementation-plan.md`.
4. Review `DISCOVERY.md` (especially the auth adapter plan and the Theme cheat sheet) before approving Phase 1.
5. Go phase by phase; each ends with stop-and-review.

## Manual steps only you can do

- Run `supabase/bazaar.sql` in the Supabase SQL editor if the Supabase MCP isn't connected (Phase 1).
- Add the new env vars below to Vercel and redeploy.
- Confirm `CRON_SECRET` is set in Vercel (Vercel sends it automatically on cron calls).

## New environment variables (add to `.env.example`, `.env.local`, Vercel)

```
# Bazaar
BAZAAR_LEAD_EMAILS=lead1@example.com,lead2@example.com   # who gets "new request" and overdue digest emails
BAZAAR_MAX_ACTIVE_REQUESTS=5
BAZAAR_MAX_LOAN_DAYS=30
```

Reused as-is: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_EMAIL`, `SMTP_PASSWORD`,
`CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, plus whatever the existing auth uses.

## Recommended extras (included)

Race-safe stock reservation, separate handover step plus "Approve & issue" shortcut, damaged/lost handling,
low-stock badges, full audit trail, email notifications + daily due/overdue reminders, CSV export.

## Ideas for v2 (not included)

Multi-item cart, return-extension requests, strike system for repeat late returns, QR/barcode labels
(you already have scanner pages), link requests to projects, Google Sheets sync, WhatsApp alerts.
