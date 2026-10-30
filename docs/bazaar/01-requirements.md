> Preserved planning/discovery reference. Read [README.md](README.md) for current scope and use AGENTS.md for current UI rules. Do not rerun historical setup steps automatically.

# 01. Requirements

Authentication is out of scope: it already exists. "Logged-in user" below means whatever the existing auth considers one.

## 1. Roles

| Role | Can do |
|---|---|
| **Member** (any logged-in user) | Browse inventory, create requests, view and cancel **own** requests |
| **Lead** | Everything a member can, plus: approve, reject, issue, receive returns, cancel any request, add/edit/deactivate items, adjust stock, manage categories, view activity log, export CSV |
| **Other staff** (e.g. desk, only if the existing auth has such a role) | Read-only on management views. No actions |

Role mapping to the existing auth is decided in Phase 0 and implemented only in `src/lib/bazaar/auth.ts`.

## 2. Request status machine

```
                  member cancels / lead cancels
        ┌────────────────────────────────────────────┐
        │                                            ▼
   [pending] ──approve──▶ [approved] ──issue──▶ [issued] ──return──▶ [returned]
        │                     │
        │ reject              │ cancel (releases reserved stock)
        ▼                     ▼
   [rejected]            [cancelled]
```

- `pending`: submitted, no stock locked.
- `approved`: stock **reserved**; waiting for physical handover.
- `issued`: with the member. **Overdue** = `issued` AND `expected_return_date < today (IST)`; derived, not a status.
- `returned`: closed, with good / damaged / lost breakdown.
- `rejected` (note required) and `cancelled`: closed.
- "Approve & issue" shortcut: `pending → issued` in one action.

## 3. Stock model (per item)

| Column | Meaning |
|---|---|
| `total_quantity` | Units owned and not written off (includes issued, reserved, damaged) |
| `reserved_quantity` | Approved, not yet handed over |
| `issued_quantity` | Currently with members |
| `damaged_quantity` | In stock but unusable |
| `available_quantity` | **Generated**: `total - reserved - issued - damaged` |

Invariant (DB-enforced): `reserved + issued + damaged <= total`; all values `>= 0`.

| Event | Effect |
|---|---|
| Approve | `reserved += qty` |
| Issue (after approve) | `reserved -= qty`, `issued += qty` |
| Approve & issue | `issued += qty` |
| Cancel an approved request | `reserved -= qty` |
| Return | `issued -= qty`; `damaged += damaged_units`; `total -= lost_units` |
| Lead adjusts stock | purchase: `total += n`; write off damaged: `total -= n, damaged -= n`; repaired: `damaged -= n` |

## 4. Business rules

1. Request fields: item*, quantity* (>= 1), purpose* (min 5 chars), project name (optional),
   **taking date***, **expected return date***.
2. `taking_date >= today (IST)`; `expected_return_date >= taking_date`;
   `expected_return_date - taking_date <= BAZAAR_MAX_LOAN_DAYS`.
3. Quantity must be `<= available_quantity` at submission **and again at approval** (re-checked under a row lock).
4. At most `BAZAAR_MAX_ACTIVE_REQUESTS` requests per user in `pending`/`approved`/`issued`.
5. A user may cancel their own request only while `pending` or `approved`. Leads can cancel any `pending`/`approved`.
6. Rejecting requires a note. Approving may include an optional note.
7. Return requires `good + damaged + lost == issued quantity`.
8. Inactive (soft-deleted) items are hidden from members. Items with request history are never hard-deleted.
9. Every state change and stock adjustment writes to `bazaar_activity_log`.
10. Concurrent approvals must never oversell (guaranteed by row locks in the SQL functions).
11. Each request stores a **snapshot** of the requester (id, name, email, reg number if available) taken from the
    existing auth at request time, so history stays readable even if the user record changes.

## 5. Notifications (email, best-effort; reuse the existing mail helper)

| Trigger | To | Content |
|---|---|---|
| Request submitted | `BAZAAR_LEAD_EMAILS` | Member, item, qty, dates, purpose, link to the manage queue |
| Approved | Member | Item, qty, taking date |
| Issued / Approved & issued | Member | Item, qty, expected return date |
| Rejected | Member | Reason |
| Returned | Member | Receipt: good / damaged / lost |
| Due tomorrow (cron) | Member | Friendly reminder |
| Overdue (cron, max once per 24 h per request) | Member | Days overdue |
| Overdue digest (cron) | `BAZAAR_LEAD_EMAILS` | List of all overdue requests |

If the requester has no email in the existing auth, skip member emails silently.

## 6. Edge cases

- Two leads approve the same request at once: second gets `409 BAZAAR_INVALID_STATE`.
- Last unit requested by two members: first approval wins; second approval fails with `BAZAAR_INSUFFICIENT_STOCK` and the request stays `pending`.
- Lead sets stock below reserved + issued + damaged: rejected with `BAZAAR_INVALID_QUANTITY`.
- Requested quantity above available at submission: rejected with a message showing the available count.
- Item deactivated with pending requests: requests remain; lead can still reject them; new requests blocked.
- Email delivery fails: the action still succeeds; error logged without personal data.
- Timezone: a user at 1 AM IST picking "today" must be accepted (always use IST).

## 7. Non-goals (v1)

Anything about authentication or user profiles, multi-item requests, per-unit serial tracking, fines, barcode scanning, extension requests.
