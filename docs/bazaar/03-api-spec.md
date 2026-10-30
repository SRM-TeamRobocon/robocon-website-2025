> Preserved planning/discovery reference. Read [README.md](README.md) for current scope and use AGENTS.md for current UI rules. Do not rerun historical setup steps automatically.

# 03. API Spec

Conventions
- Next.js App Router route handlers (`src/app/api/bazaar/.../route.ts`). Check the installed Next version:
  `params` may be a Promise and must be awaited.
- JSON in/out. Dates are `YYYY-MM-DD` (IST calendar dates). Timestamps are ISO strings.
- Mutations call the SQL functions from `02-database.md` via `supabase.rpc(...)` with the **service-role** client.
- Success: `200`/`201` with the resource or `{ "ok": true }`.
- Error shape (always): `{ "error": { "code": "BAZAAR_...", "message": "Human-readable" } }`.
- Lists: `?page=1&pageSize=25` (max 100) → `{ "data": [...], "page": 1, "pageSize": 25, "total": 123 }`.

## Auth adapter (`src/lib/bazaar/auth.ts`): the ONLY file that touches the existing auth

Authentication already exists and must not be changed. In Phase 0 Cline finds how the existing system identifies
the current user and role, then this adapter normalises it:

```ts
type BazaarUser = {
  id: string;            // stable id from the existing auth (string, whatever its original format)
  name: string;
  email?: string;
  regNumber?: string;    // only if the existing auth/profile already has it
  role: 'lead' | 'viewer' | 'member'; // viewer = other staff (e.g. desk), read-only on manage views
};
```

| Helper | Behaviour |
|---|---|
| `getCurrentUser(req?)` | Reads the existing session/token, returns `BazaarUser \| null` |
| `requireUser()` | Any logged-in user. 401 `BAZAAR_UNAUTHENTICATED` if none |
| `requireViewer()` | `lead` or `viewer`. 403 `BAZAAR_FORBIDDEN` otherwise |
| `requireLead()` | `lead` only. 403 `BAZAAR_FORBIDDEN` otherwise |

Actor string for SQL functions and the audit log: `` `${user.role}:${user.id}` ``.

If the existing auth does not expose a stable id or a display name, **STOP and ask**. Do not build profile features.

## Error codes and HTTP mapping

| Code | HTTP | When |
|---|---|---|
| `BAZAAR_UNAUTHENTICATED` | 401 | Not logged in |
| `BAZAAR_FORBIDDEN` | 403 | Role not allowed |
| `BAZAAR_VALIDATION` | 400 | Body/query failed validation (include field messages) |
| `BAZAAR_INVALID_DATES` | 400 | Date rules violated |
| `BAZAAR_INVALID_QUANTITY` | 400 | Quantity rules violated |
| `BAZAAR_NOT_FOUND` / `BAZAAR_ITEM_NOT_FOUND` | 404 | Missing request/item (also: someone else's request) |
| `BAZAAR_INVALID_STATE` | 409 | Action not allowed in current status |
| `BAZAAR_INSUFFICIENT_STOCK` | 409 | Not enough available units |
| `BAZAAR_LIMIT_REACHED` | 409 | User at max active requests |
| `BAZAAR_DUPLICATE` | 409 | Unique violation (item name, category name) |
| `BAZAAR_INTERNAL` | 500 | Anything else (log server-side, generic message to client) |

`mapDbError(error)` in `src/lib/bazaar/errors.ts`: Postgres exceptions surface in `error.message` containing the
`BAZAAR_*` code; SQLSTATE `23505` → `BAZAAR_DUPLICATE`.

## A. Member routes (`requireUser`)

| Method & path | Body / query | Response |
|---|---|---|
| `GET /api/bazaar/me` | - | `{ id, name, role }` (so the UI knows which tabs to show; nothing sensitive) |
| `GET /api/bazaar/categories` | - | `[{ id, name }]` |
| `GET /api/bazaar/items` | `?q=&category=<id>&inStock=1&page=&pageSize=` | Active items: `id, name, description, category{id,name}, location, image_url, available_quantity`. **Never** expose reserved/issued/damaged counters |
| `GET /api/bazaar/items/:id` | - | Single item (same fields) |
| `GET /api/bazaar/requests` | `?status=&page=` | **Caller's own** requests with `item{id,name,image_url}` |
| `POST /api/bazaar/requests` | `{ item_id, quantity, purpose, project_name?, taking_date, expected_return_date }` | `201 { id }` via `bazaar_create_request` (requester snapshot comes from the adapter, **never from the body**; pass `BAZAAR_MAX_ACTIVE_REQUESTS` / `BAZAAR_MAX_LOAN_DAYS`). Then email leads |
| `POST /api/bazaar/requests/:id/cancel` | - | `{ ok: true }`. Load the request first; if `member_id !== user.id` return 404 |

Validation: `quantity` int 1 to 10000; `purpose` trimmed 5 to 500 chars; `project_name` trimmed max 120;
dates valid `YYYY-MM-DD`. Client checks are only UX; the SQL function is authoritative.

## B. Management routes (`/api/bazaar/manage/*`): GET = `requireViewer`, everything else = `requireLead`

### Inventory
| Method & path | Notes |
|---|---|
| `GET /manage/items` | `?q=&category=&lowStock=1&inactive=1&page=` → full rows incl. all counters + category |
| `POST /manage/items` | `{ name, description?, category_id?, location?, image_url?, total_quantity, low_stock_threshold? }` → `201`. Log `item_created` |
| `GET /manage/items/:id` | Item + recent activity |
| `PUT /manage/items/:id` | Descriptive fields only: `name, description, category_id, location, image_url, low_stock_threshold, is_active`. **Never** stock counters |
| `DELETE /manage/items/:id` | **Soft delete** (`is_active=false`). Hard delete only if the item has zero requests, else 409 |
| `POST /manage/items/:id/stock-adjust` | `{ total_delta, damaged_delta, note? }` → `bazaar_adjust_stock`. Note required when `total_delta < 0` |
| `POST /manage/upload` | multipart image (png/jpeg/webp, max 2 MB) → `{ url }` in bucket `bazaar-items`. Reuse the existing upload helper's pattern if suitable |

### Categories
`GET /manage/categories`, `POST /manage/categories {name}`, `PUT /manage/categories/:id {name}`, `DELETE /manage/categories/:id`.

### Requests
| Method & path | Body | SQL function |
|---|---|---|
| `GET /manage/requests` | `?status=&overdue=1&member=<id>&item=<id>&from=&to=&q=&page=` → rows with `item{id,name,image_url,available_quantity}`, requester snapshot fields, computed `is_overdue`, `days_overdue` | - |
| `GET /manage/requests/:id` | request + activity entries | - |
| `POST /manage/requests/:id/approve` | `{ note?, issue?: boolean }` | `bazaar_approve_request` |
| `POST /manage/requests/:id/reject` | `{ note }` (required, 3 to 500 chars) | `bazaar_reject_request` |
| `POST /manage/requests/:id/issue` | - | `bazaar_issue_request` |
| `POST /manage/requests/:id/return` | `{ good, damaged, lost, note? }` (ints >= 0, sum must equal quantity) | `bazaar_return_request` |
| `POST /manage/requests/:id/cancel` | `{ note? }` | `bazaar_cancel_request` |

After each successful action, send the matching email (see `01-requirements.md` section 5), best-effort.

`is_overdue = status === 'issued' && expected_return_date < todayIST()`. One `todayIST()` in
`src/lib/bazaar/dates.ts`, used by API, cron and UI.

### Dashboard, audit, export
| Method & path | Response |
|---|---|
| `GET /manage/stats` | `{ pending, approvedAwaitingHandover, issued, overdue, lowStockItems, totalItems }` |
| `GET /manage/activity` | `?item=&request=&actor=&page=` → paged log, newest first |
| `GET /manage/export/requests` | CSV of requests (same filters as the list, no paging). `Content-Type: text/csv`, `Content-Disposition: attachment`. **Escape cells and neutralise formula injection** (prefix cells starting with `= + - @` with `'`) |

## C. Cron: `GET /api/cron/bazaar-reminders`

- Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel sends this automatically). Mirror the existing cron route's
  pattern if there is one. 401 otherwise.
- Logic (IST dates):
  1. **Due tomorrow**: `status='issued' AND expected_return_date = today+1` → reminder email (skip if `last_reminder_at` is today).
  2. **Overdue**: `status='issued' AND expected_return_date < today` and (`last_reminder_at` null or older than 24 h) → reminder email; set `last_reminder_at = now()`.
  3. One **digest email** to `BAZAAR_LEAD_EMAILS` listing all overdue requests (if any).
- Returns `{ dueTomorrow, overdue, emailsSent, emailFailures }`.
- Add to `vercel.json` (create if missing; keep existing crons): `{ "path": "/api/cron/bazaar-reminders", "schedule": "30 3 * * *" }`
  (09:00 IST; Vercel cron schedules are UTC).
