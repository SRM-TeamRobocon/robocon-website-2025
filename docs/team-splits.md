# Team Splits

Team Splits lets approved members and staff create requests to collect money
directly into the creator's UPI account. It uses the existing dashboard session,
Supabase server client, and `qrcode` dependency. There is no gateway account,
bank observer, wallet, payment webhook, or automatic settlement verification.

## Dashboard flow

- `/dashboard/splits`: paginated **My payments** and **Created by me** lists.
- `/dashboard/splits/new`: select approved members, enter the creator's UPI ID
  and recipient name, then choose equal shares or custom amounts.
- `/dashboard/splits/[id]`: payment instructions, locally generated QR, UPI app
  link, transaction-reference submission, creator review, and payment activity.

The total is the amount to collect from other members, excluding the creator's
own share. Title, recipient details, participants, and amounts are immutable
after creation. A creator can cancel only while no payment has been reported.
They should also check their bank for payments that have not yet been reported.

Opening a UPI app, returning to the website, or submitting a transaction
reference never marks a payment confirmed. A participant reports their own
payment; the creator checks the actual receiving bank account and confirms it
or returns it for correction with a reason. A rejected reference is retained
with the activity history. Members must resolve a previously reported payment
with the creator before paying again.

## API contracts

All handlers require a valid dashboard session and return private, non-cacheable
responses. Approval is rechecked by the existing `getSession()` helper for
member-backed sessions.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/member/splits?scope=owed\|created&page=0` | List 20 requests per page; return `hasMore` for pagination. |
| `POST /api/member/splits` | Create one request with a client UUID, title, description, UPI ID, payee name, decimal total, split mode, and participant IDs/custom amounts. |
| `GET /api/member/splits/members` | Return approved member IDs, names, and domains, excluding the current member; at most 1,000 directory entries. |
| `GET /api/member/splits/[id]` | Read a request as its creator or a selected participant. |
| `PATCH /api/member/splits/[id]` | Apply `report`, `confirm`, `reject`, or `cancel` with the current `version`. |

The server derives the actor from the session and resolves participant names
from approved accounts. An unrelated member, including an unrelated admin,
cannot view or review a request. Staff using legacy environment credentials can
create requests, but only actual member accounts appear in the participant
directory.

Participants can see the request's participant names, shares, and statuses.
Transaction references and review notes are visible only to their payer and
the creator. A participant's activity view is limited to their own payment.

## Amounts and concurrent edits

Amounts are parsed from decimal text into integer paise, between INR 0.01 and
INR 10,00,000. These are application validation bounds, not bank transaction
limits. Equal splitting distributes any remaining paise in participant order;
custom amounts must sum exactly to the requested total. A request allows
1–100 distinct approved participants and excludes the creator's own member ID.

The complete request, shares, and activity live in one `team_splits` row so
creation is atomic. A client-generated request UUID makes creation retries
idempotent. Updates compare the submitted version with the stored version and
also condition the database update on that version. A stale update receives
HTTP 409 and must refresh. This prevents a stale confirmation from approving a
newer report or overwriting another review.

The activity array is bounded at 1,000 entries per split; the UI shows the most
recent 50 entries visible to the viewer. References are checked for duplicates
within a split, not across every split or against bank records.

## Deployment prerequisite

Apply [supabase/team-splits.sql](../supabase/team-splits.sql) to the intended
Supabase project **before deploying these routes**. It creates the table and
indexes, enables RLS, revokes direct access from `anon` and `authenticated`, and
grants the service role only the operations needed by the handlers. The app's
custom JWT sessions are authorized in the server routes; the browser never
receives a service-role credential.

No new environment variables are needed. Confirm the active Supabase URL and
service-role configuration point to the main project before applying the SQL.
Do not rerun the entire historical schema as a substitute for this migration.
If rolling back the UI, retain the table and payment history rather than
dropping records.

## Validation and limits

Run the focused offline rules tests with
`npx tsx --test scripts/tests/team-splits.test.ts`, followed by TypeScript and
the relevant lint/build checks described in [development workflow](development-workflow.md).
Use synthetic data to exercise payer/creator views, stale versions, denied
access, and report/review flows before accepting live requests.

UPI app launch depends on the browser, device, and installed payment app; the
QR and visible UPI ID are alternative ways to pay. The website cannot check UPI
account ownership or whether funds actually arrived. Creators must reconcile
their receiving bank records, and handle incorrect payments, refunds, and
disputes outside this first version. Confirmed records cannot be reversed in
the dashboard. No automatic reminders or emails are sent by Team Splits.
