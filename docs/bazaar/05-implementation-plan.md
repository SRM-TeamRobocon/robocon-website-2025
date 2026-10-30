> Preserved planning/discovery reference. Read [README.md](README.md) for current scope and use AGENTS.md for current UI rules. Do not rerun historical setup steps automatically.

# 05. Implementation Plan

Rules: one phase at a time, **Plan Mode first**, stop after each phase for review. Tick boxes as you go.
Each phase has a **prompt to paste into Cline**. Authentication is already done; no phase touches it.

Target layout (confirm in Phase 0 and adapt to the repo's real conventions; `{DASH}` = existing dashboard base path):

```
supabase/bazaar.sql
src/lib/bazaar/
  config.ts        # BAZAAR_NAME, limits and lead emails from env
  types.ts
  dates.ts         # todayIST(), formatDate(), daysBetween()
  errors.ts        # BazaarError, mapDbError(), jsonError()
  validation.ts    # zod schemas (or manual validators)
  auth.ts          # ADAPTER over the existing auth: getCurrentUser/requireUser/requireViewer/requireLead
  supabase.ts      # server-only service-role client (reuse the existing one if there is one)
  email.ts         # templates + send helpers wrapping the existing mail helper
  csv.ts           # safe CSV builder
src/app/api/bazaar/...                 # member routes
src/app/api/bazaar/manage/...          # management routes
src/app/api/cron/bazaar-reminders/route.ts
src/app/{DASH}/bazaar/...              # UI (placed inside the existing dashboard)
```

---

## Phase 0: Discovery + Theme audit (READ-ONLY, no code changes)

**Prompt:**
> Read `.clinerules/bazaar.md` and every file in `docs/bazaar/` (00 to 05). Then inspect the repo read-only and write
> `docs/bazaar/DISCOVERY.md` answering:
> 1. Versions of Next.js, React, Tailwind, Supabase client. Is `zod` installed?
> 2. **Existing auth (do not change it):** how is the current user identified in a server component and in an API route handler? Exact file/function names. What fields are available (id, name, email, reg number, role)? How are lead vs other staff vs normal members distinguished? Propose the exact implementation of `src/lib/bazaar/auth.ts` (`getCurrentUser`, `requireUser`, `requireViewer`, `requireLead`). If an id or display name is missing, say so; do NOT propose building profile features.
> 3. Existing dashboard: base path, layout wrapper, nav/sidebar file(s), how to add a "Siesed Bazaar" entry, how pages are structured.
> 4. **Theme cheat sheet** (see `.clinerules/bazaar.md` section 3): Tailwind colors/fonts/radius/shadows, global CSS variables, dark/light behaviour, and the exact existing components or class patterns for buttons, inputs, selects, cards, tables, modals/drawers, tabs, badges, toasts, loaders, empty states, icons. Include import paths. State which existing semantic colours map to pending/approved/issued/overdue/returned/rejected/cancelled.
> 5. How `src/proxy.ts` works. Would it block or redirect `{DASH}/bazaar/**`, `/api/bazaar/**`, `/api/cron/**`? Is any change needed?
> 6. How the existing code creates the Supabase service-role client; how the existing upload route works and whether it can be reused for bucket `bazaar-items`.
> 7. The existing Nodemailer/SMTP helper and its API.
> 8. Existing cron route pattern and `CRON_SECRET` check; does `vercel.json` exist?
> 9. How `supabase/schema.sql` configures storage buckets and RLS.
> 10. Anything in the spec that conflicts with reality, with your proposed resolution.
> Do not modify any other file. Stop when done.

**Acceptance:** `DISCOVERY.md` exists, answers all 10 points with file paths, includes the Theme cheat sheet and the proposed auth adapter. Nothing else changed.

- [ ] Phase 0 complete and reviewed

---

## Phase 1: Database

**Prompt:**
> Phase 1. Create `supabase/bazaar.sql` from section 1 of `docs/bazaar/02-database.md` (adjust only for conflicts in DISCOVERY.md and tell me what you changed). Apply it with the Supabase MCP `apply_migration` if available; otherwise stop and tell me to run it in the SQL editor. Then run the verification queries from section 2 and show the results. Do not touch existing tables.

**Acceptance:** 4 tables with RLS on; 7 workflow functions executable only by `service_role`; bucket `bazaar-items` exists.

- [ ] Phase 1 complete

---

## Phase 2: Shared library + env + auth adapter

**Prompt:**
> Phase 2. Create `src/lib/bazaar/*` as laid out in `05-implementation-plan.md`: config (reads `BAZAAR_LEAD_EMAILS`, `BAZAAR_MAX_ACTIVE_REQUESTS`, `BAZAAR_MAX_LOAN_DAYS` with safe defaults, exports `BAZAAR_NAME = "Siesed Bazaar"`), types, dates (`todayIST`), errors, validation, supabase (server-only; reuse the existing service-role client if one exists), csv, and the **auth adapter** exactly as proposed in DISCOVERY.md. The adapter must only wrap the existing auth. Do not modify any existing auth file. Add the new env vars to `.env.example` with comments. No routes or UI yet. Run `./node_modules/.bin/tsc --noEmit`.

**Acceptance:** compiles; no `any`; service-role client importable only from server files; adapter returns a normalised `BazaarUser` and `requireLead` rejects non-lead roles (explain how you verified).

- [ ] Phase 2 complete

---

## Phase 3: API (member + management)

**Prompt:**
> Phase 3. Implement all routes from `03-api-spec.md` sections A and B under `src/app/api/bazaar/` and `src/app/api/bazaar/manage/`. Use `requireUser` for member routes, `requireViewer` for management GETs, `requireLead` for every management mutation. Requester details come from the adapter, never from the request body. Call SQL functions via `rpc`; never mutate quantities in TypeScript. Use `mapDbError` and the standard error shape. Email sending is a stub for now (`TODO Phase 6`). Verify with tsc and build, then give me a table of routes, methods and guards.

**Acceptance:** every documented route exists; members can't see others' requests (404); non-leads get 403 on mutations; documented 409s appear for bad state/stock; members never receive reserved/issued/damaged counters.

- [ ] Phase 3 complete

---

## Phase 4: Management UI (lead/viewer)

**Prompt:**
> Phase 4. Build the management screens from `04-ui-spec.md` section 3 (Overview, Inventory with add/edit, adjust stock and categories modals, Requests with tabs/actions/drawer/CSV export, Activity) under `{DASH}/bazaar/manage/`. Add the "{BAZAAR_NAME}" entry to the existing dashboard nav. **Strictly follow the Theme cheat sheet in DISCOVERY.md**: reuse existing components, no new colours/fonts/libs. Hide/disable actions for non-leads. Include loading/empty/error states and confirm dialogs. Verify with tsc and build, and finish with a **Theme check** report (desktop + 375 px).

**Acceptance:** a lead can run the full inventory + request workflow from the UI; viewers see read-only; Theme check shows no visual mismatch with existing dashboard pages.

- [ ] Phase 4 complete

---

## Phase 5: Member UI

**Prompt:**
> Phase 5. Build the member screens from `04-ui-spec.md` section 2 under `{DASH}/bazaar/` and `{DASH}/bazaar/my-requests`: Browse with the request modal (date of taking, expected return date, live validation), My Requests (cancel, timeline, overdue banner). Do not create any auth, login, or profile UI. **Strictly follow the Theme cheat sheet.** Mobile-first. Never use the service-role client in client components. Finish with a **Theme check** report.

**Acceptance:** a logged-in user can browse, submit a request with both dates, see it in My Requests, and cancel while pending/approved; Theme check clean; works at 375 px.

- [ ] Phase 5 complete

---

## Phase 6: Emails + cron

**Prompt:**
> Phase 6. Implement `src/lib/bazaar/email.ts` on top of the existing mail helper with the templates in `01-requirements.md` section 5 (clean HTML + plain text, links using `NEXT_PUBLIC_SITE_URL`). Wire them into the routes as best-effort (never fail the action if the email fails; skip member emails when the requester has no email). Implement `GET /api/cron/bazaar-reminders` as `src/app/api/cron/bazaar-reminders/route.ts` per `03-api-spec.md` section C, protected by `CRON_SECRET`, and add the schedule to `vercel.json` without removing existing entries.

**Acceptance:** each workflow step sends the right email; cron returns the documented JSON; 401 without the secret; at most one reminder per 24 h per request.

- [ ] Phase 6 complete

---

## Phase 7: Hardening, docs, final QA

**Prompt:**
> Phase 7. Security pass: (a) service-role client never imported in client code, (b) every `/api/bazaar/manage` mutation calls `requireLead`, (c) every `/api/bazaar` route calls `requireUser` or stricter, (d) CSV export neutralises formula injection, (e) no personal data in logs, (f) errors never leak SQL, (g) existing auth files are unchanged (`git diff --stat` on them). Then add a "Bazaar" section to `README.md` (routes, env vars, roles, setup) and run the manual test matrix below, reporting pass/fail per row. Fix failures. Finish with `tsc --noEmit`, `npm run build`, and a final **Theme check** of every new screen.

- [ ] Phase 7 complete

---

## Manual test matrix (Phase 7)

| # | Scenario | Expected |
|---|---|---|
| 1 | Logged-out user opens `{DASH}/bazaar` | Handled by the existing auth (same as any dashboard page) |
| 2 | Member opens Browse | Sees active items with available count only |
| 3 | Member requests qty greater than available | Error showing available count |
| 4 | Past taking date / return before taking / loan > 30 days | `BAZAAR_INVALID_DATES` |
| 5 | Member creates 6th active request | `BAZAAR_LIMIT_REACHED` |
| 6 | Lead approves | `reserved` +qty, `available` -qty; member emailed |
| 7 | Two requests for the last unit; approve first, then second | Second gets `BAZAAR_INSUFFICIENT_STOCK`, stays pending |
| 8 | Approve the same request in two tabs at once | One succeeds, one gets `BAZAAR_INVALID_STATE` |
| 9 | Mark approved request as issued | `reserved` -qty, `issued` +qty |
| 10 | "Approve & issue" on a pending request | Directly `issued` |
| 11 | Member cancels an approved request | Reserved stock released |
| 12 | Member tries to cancel an issued request | `BAZAAR_INVALID_STATE` / button hidden |
| 13 | Member A cancels member B's request via direct API call | 404 |
| 14 | Return with good + damaged + lost != qty | `BAZAAR_INVALID_QUANTITY` |
| 15 | Return with 1 damaged, 1 lost | `issued` -qty, `damaged` +1, `total` -1, available recomputed |
| 16 | Non-lead calls approve / stock-adjust via API | 403 |
| 17 | Member calls `/api/bazaar/manage/items` | 403 |
| 18 | Lead lowers total below reserved+issued+damaged | `BAZAAR_INVALID_QUANTITY` |
| 19 | Dev DB: set an issued request's return date to yesterday | Shown as Overdue in manage and member views |
| 20 | Cron without / with wrong secret | 401 |
| 21 | Cron with secret | JSON summary; overdue member emailed once; leads get digest |
| 22 | CSV export with an item named `=1+1` | Cell neutralised (`'=1+1`) |
| 23 | Deactivate an item with history | Hidden from members; history intact; hard delete refused |
| 24 | 375 px width on every Bazaar page | No horizontal scroll; all actions reachable |
| 25 | Side-by-side with an existing dashboard page | Same colours, fonts, spacing, components (Theme check) |
| 26 | Existing site (public pages, CMS, existing logins) | Works exactly as before |
