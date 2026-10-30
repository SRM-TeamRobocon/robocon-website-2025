> Preserved planning/discovery reference. Read [README.md](README.md) for current scope and use AGENTS.md for current UI rules. Do not rerun historical setup steps automatically.

# 04. UI Spec

Authentication UI is out of scope (login, signup, onboarding already exist). Bazaar lives **inside the existing dashboard**,
so users are already logged in when they reach it.

## 0. Theme and consistency (mandatory, applies to every screen below)

The Bazaar UI must be visually indistinguishable in style from the existing dashboard.

- Use the **Theme cheat sheet** that Phase 0 records in `DISCOVERY.md`. Treat it as the only design system.
- Reuse existing layout wrapper, page heading style, sidebar/nav pattern, buttons, inputs, selects, cards, tables,
  modals/drawers, tabs, badges, toasts, loaders and empty states. If one exists, import it. Do not recreate it.
- No new colors, fonts, icon libraries, UI libraries, or hardcoded hex/rgb. Use existing Tailwind tokens, classes and CSS variables.
- Keep the existing spacing scale, radius, shadows, hover/focus/disabled states, and dark/light behaviour (if any).
- Status badges use the project's palette (map to its existing success / warning / danger / info / neutral styles):

  | Status | Meaning style |
  |---|---|
  | pending | warning |
  | approved | info |
  | issued | info (stronger) or primary |
  | overdue (shown instead of issued) | danger |
  | returned | success |
  | rejected | danger (outline/subtle) |
  | cancelled | neutral |

  If the theme has no suitable semantic colours, use the closest existing tokens and tell the user.
- Every UI phase ends with a **Theme check**: compare an existing dashboard page and the new page at desktop and 375 px
  (screenshots if a browser tool is available) and report any differences found and fixed.

## 1. Navigation and routes

Let `{DASH}` be the existing dashboard base path found in Phase 0 (e.g. `/dashboard` or `/admin/dashboard`).
Add one entry **"{BAZAAR_NAME}"** to the existing dashboard navigation, linking to `{DASH}/bazaar`.
Tabs are role-aware (use `GET /api/bazaar/me` or the adapter on the server).

| Route | Visible to | Purpose |
|---|---|---|
| `{DASH}/bazaar` | everyone | Browse components + request |
| `{DASH}/bazaar/my-requests` | everyone | Own requests |
| `{DASH}/bazaar/manage` | lead, viewer | Overview |
| `{DASH}/bazaar/manage/inventory` | lead, viewer | Items |
| `{DASH}/bazaar/manage/requests` | lead, viewer | Queue and history |
| `{DASH}/bazaar/manage/activity` | lead, viewer | Audit log |

Tab bar across the section: **Browse · My Requests** for everyone, plus **Manage** (with sub-tabs
Overview · Inventory · Requests · Activity) for lead/viewer. Viewers see data but action buttons are hidden or
disabled with a "Leads only" tooltip. The API enforces this regardless.

## 2. Member screens

### 2.1 Browse
- Search, category chips, "In stock only" toggle.
- Responsive grid of cards: photo (placeholder if none), name, category, location, **"{n} available"** or "Out of stock",
  **Request** button (disabled when out of stock).
- **Request modal** (or page, whichever matches the dashboard's pattern):
  - Item summary (photo, name, available count)
  - Quantity* (stepper, 1 to available)
  - Purpose* (textarea), Project name (optional)
  - **Date of taking*** (date input, `min` = today IST, default today)
  - **Expected return date*** (date input, `min` = taking date, `max` = taking date + `BAZAAR_MAX_LOAN_DAYS`)
  - Submit → success state "Request submitted. A lead will review it." with link to My Requests
  - Plain-language errors for insufficient stock (show available count), limit reached, invalid dates

### 2.2 My Requests
- Tabs: Active (pending/approved/issued) · History.
- Card on mobile, table on desktop: item, qty, dates, status badge, lead's note (if any).
- Overdue warning banner on overdue items ("Due 3 days ago, please return it").
- **Cancel** button for `pending` and `approved` only (confirm dialog). Hidden once issued.
- Status timeline: Requested → Approved → Issued → Returned, with timestamps.

## 3. Management screens (lead = actions, viewer = read-only)

### 3.1 Overview
- Stat cards from `GET /manage/stats`: **Pending**, **Awaiting handover**, **Issued**, **Overdue** (danger style if > 0),
  **Low-stock items**. Each links to the relevant filtered page.
- "Needs attention": oldest 5 pending requests with inline Approve / Reject; top 5 overdue.

### 3.2 Inventory
- Toolbar: search, category filter, "Low stock only", "Show inactive", **Add item**, **Manage categories**.
- Table columns: photo thumb, name (+ description snippet), category, location, **Total / Available / Reserved / Issued / Damaged**,
  low-stock badge (when `available <= low_stock_threshold` and threshold > 0), status, actions. Cards on mobile.
- Row actions: Edit, **Adjust stock**, Deactivate/Reactivate (confirm).
- **Add/Edit item modal**: name*, category (select + inline "new category"), description, location (e.g. "Shelf B3"),
  photo upload (preview, 2 MB, png/jpg/webp), initial `total_quantity` (add only), low-stock threshold, active toggle.
  Editing never changes stock numbers.
- **Adjust stock modal**: type → deltas:
  - "Add stock (purchase)" → `total_delta = +n`
  - "Write off damaged" → `total_delta = -n, damaged_delta = -n`
  - "Mark repaired" → `damaged_delta = -n`
  Show current numbers and a live preview of the result; note required for write-offs; confirm dialog;
  surface `BAZAAR_INVALID_QUANTITY` clearly.
- Categories modal: add, rename, delete.

### 3.3 Requests
- Tabs with counts: **Pending · To hand over (approved) · Issued · Overdue · History**.
- Filters: search (member name / reg no / item), date range, item.
- Row: requester (name, reg no if present), item + qty, purpose (truncate, expand), **taking date → expected return date**,
  status badge, days overdue, actions.
- Actions by status (lead only):
  - Pending: **Approve**, **Approve & issue**, **Reject** (modal with required reason)
  - Approved: **Mark issued**, **Cancel**
  - Issued/Overdue: **Mark returned** (modal: good / damaged / lost, prefilled good = qty, must sum to qty, optional note)
  - Others: view only
- On `BAZAAR_INSUFFICIENT_STOCK`, show the item's current available count in the message.
- Row click → side drawer (or the dashboard's detail pattern) with full details + activity timeline.
- **Export CSV** honouring current filters.

### 3.4 Activity
- Paged log, newest first: time, actor, action, item, request link, detail summary. Filters: item, actor.

## 4. Behaviour and polish
- Every list: loading skeleton (use the existing loader style), empty state, error state with retry.
- Mutating buttons: disabled + spinner while pending; toast on success/error (existing toast system); no double-submit.
- Confirm dialogs: reject, mark returned, stock adjust, deactivate, cancel.
- Dates displayed as `DD MMM YYYY` (e.g. `15 Oct 2026`).
- All inputs labelled; modals trap focus and close on Esc; colour is never the only status indicator (badges have text).
- Lazy-load images; use `next/image` if the project already does.
