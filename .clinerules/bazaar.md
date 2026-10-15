# Cline Rules: Bazaar (Inventory + Component Requests)

These rules apply to ALL work on the Bazaar feature: `src/**/bazaar/**`, `src/app/api/**/bazaar/**`,
`supabase/bazaar.sql`, and `docs/bazaar/**`.

## 1. Source of truth

- The spec lives in `docs/bazaar/`. Read ALL files `00` to `05` before writing any code.
- Also read `CLAUDE.md` and `README.md` at the repo root.
- If the real code contradicts the spec, **STOP and ask**. Do not silently improvise.
- The feature's display name is one constant: `BAZAAR_NAME` in `src/lib/bazaar/config.ts` (default `"Siesed Bazaar"`).
  Never hardcode the name anywhere else.

## 2. Scope: Bazaar only. Authentication is ALREADY DONE

- **Do NOT build, change, or add** any login, signup, onboarding, session, password-reset, user-profile, or
  member-verification functionality. Do not install auth packages. Do not change Supabase Auth settings.
- Use the **existing** authentication exactly as it is. Phase 0 discovers how it identifies the current user
  and their role. Phase 2 wraps that in ONE small adapter file, `src/lib/bazaar/auth.ts`. That file is the
  only place Bazaar code touches the existing auth. Everything else calls the adapter.
- Role rules (map to whatever roles the existing system has; confirm in Phase 0):
  - Any logged-in user can browse and create requests, and see/cancel their own requests.
  - **Lead** only: approve, reject, issue, receive returns, cancel others' requests, edit inventory, adjust stock.
  - Any other staff role that exists (e.g. desk): read-only on management views, if such a role exists.
- Enforce roles inside each route handler via the adapter's `requireUser()`, `requireViewer()`, `requireLead()`.
  Never trust the UI to hide buttons.

## 3. Theme and UI consistency (MANDATORY)

The Bazaar UI must look like it was always part of the existing dashboard.

- In Phase 0, do a **theme audit** and record a "Theme cheat sheet" in `docs/bazaar/DISCOVERY.md`:
  Tailwind config colors/fonts/radii/shadows (`tailwind.config.ts`), global CSS/CSS variables, dark/light behaviour,
  dashboard layout wrapper, sidebar/nav pattern, page headings, buttons, inputs, selects, cards, tables, modals,
  tabs, badges, toasts, empty/loading states, icon library.
- **Reuse existing components and class patterns.** If an equivalent component exists, import it; do not recreate it.
- **Do not introduce** new colors, fonts, icon sets, UI libraries, or CSS frameworks. No hardcoded hex/rgb values:
  use the project's Tailwind tokens/classes/CSS variables only.
- Status badges (pending/approved/issued/overdue/returned/rejected/cancelled) must be built from the project's own
  palette. Only if the theme has no suitable semantic colours, use the closest existing tokens and tell the user.
- Match spacing, typography scale, border radius, hover/focus states, and responsive breakpoints of existing dashboard pages.
- Respect dark/light mode if the dashboard has it.
- If a browser/Playwright tool is available, open an existing dashboard page and the new Bazaar page at desktop and
  375 px widths and compare. State the result of this **Theme check** at the end of every UI phase.

## 4. Workflow

- Work **one phase at a time** from `docs/bazaar/05-implementation-plan.md`.
- **Plan Mode first** each phase; Act Mode only after the plan is approved.
- End every phase with: checks run (section 6), checklist ticked, short summary (files changed, anything unexpected),
  then **STOP and wait** for the go-ahead.
- Keep diffs small. No drive-by refactors or reformatting of untouched files.

## 5. Do NOT touch

- Existing auth code, `src/proxy.ts` (unless Phase 0 proves a change is unavoidable; then minimal diff and explain),
  public pages, CMS routes/UI, attendance, registration, Razorpay, Google Sheets code, `scripts/migrate-content.ts`,
  existing tables in `supabase/schema.sql`.
- `.env.local` or any real secret. Only edit `.env.example`.

## 6. Data and security rules

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never import the service-role client into a client component.
- All writes go through API route handlers. The browser never writes to Supabase tables directly.
- **Stock numbers change ONLY via the SQL functions in `supabase/bazaar.sql`.** Never read-modify-write quantities
  in TypeScript. This prevents race conditions.
- Validate every request body server-side (use `zod` if already installed; otherwise ask before adding).
- RLS enabled on every `bazaar_*` table with no client policies (server-only access).
- "Today" and all date comparisons use **Asia/Kolkata**. One `todayIST()` helper, used everywhere.
- Standard error shape: `{ "error": { "code": "...", "message": "..." } }`. Never leak stack traces or SQL text.
- A user may only ever see and cancel their **own** requests (404 for others, never reveal existence).
- Emails are best-effort: send after the DB change succeeds, catch and log failures, never fail the action over email.
- No personal data (email, phone, reg number) in `console.log`.

## 7. Tech and quality rules

- Next.js App Router + TypeScript (strict) + Tailwind. No `any`; types in `src/lib/bazaar/types.ts`.
- Check the installed Next.js version. `params`, `searchParams`, `cookies()`, `headers()` may be **async**; follow
  the existing code and that version's docs.
- Server Components by default; `"use client"` only where interaction is needed.
- New dependencies: ask first (zod is the only one I expect to be OK if missing).
- Every list/table: loading, empty, and error states. Destructive actions (reject, mark returned, stock adjust,
  deactivate) need a confirmation dialog.
- Mobile-first: usable at 375 px width.
- **Verification commands** after every phase:
  - `./node_modules/.bin/tsc --noEmit`
  - `npm run build`
  - `npm run lint` is known-broken (`next lint` incompatible). Do NOT try to fix it.

## 8. Database rules

- All Bazaar schema lives in ONE idempotent file: `supabase/bazaar.sql` (safe to re-run).
- Apply via the Supabase MCP `apply_migration` if available; otherwise tell the user to run it in the SQL editor.
- Never run destructive SQL against existing tables. After applying, run the verification queries in `02-database.md`.

## 9. Definition of done (per phase)

1. Type-check and build pass.
2. Acceptance criteria met, with a statement of how you checked.
3. No changes outside the phase's files unless explained.
4. For UI phases: **Theme check** reported.
5. Checklist updated; summary posted; Cline stops for approval.
