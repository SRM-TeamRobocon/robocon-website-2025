> Historical optimization plan. Verify against current source; these phases are not an active task or permission to modify production.

# Edge, Performance, and Rate-Limit Optimization Plan

This document is the execution plan for improving request latency, serverless
reliability, abuse resistance, and database performance in the Robocon website.
Agents should complete the phases in order unless a phase is explicitly skipped.

## Project constraints

- The application is Next.js App Router with TypeScript.
- Supabase is used for CMS, members, recruitment, attendance, and dashboard data.
- Google Sheets, Google OAuth, Nodemailer, bcrypt, QR generation, XLSX, and
  Puppeteer/Chromium are Node-oriented integrations.
- `src/proxy.ts` is already Edge-compatible and verifies JWTs without a database
  call.
- `npm run lint` is not reliable with the installed Next.js version. Use
  `npx tsc --noEmit`, `npm run build`, and targeted manual/browser checks.
- Do not run the full `supabase/schema.sql` against a populated production
  database as a performance task. Use a focused migration and review it first.
- Preserve unrelated worktree changes. Do not reset, checkout, or overwrite them.
- Do not add em dashes to files under `src/`.

## Non-negotiable safety rules

1. Never expose `SUPABASE_SERVICE_ROLE_KEY`, SMTP credentials, JWT secrets, or
   device secrets to client code.
2. Never implement rate limiting with a process-local `Map` in a serverless
   deployment. Instances are independent.
3. Never put Supabase database lookups into `src/proxy.ts`. Middleware must stay
   a cheap JWT gate.
4. Never mark a route `runtime = "edge"` until every imported dependency is
   Edge-compatible.
5. Never cache authenticated, member-specific, attendance, admin, login, reset
   password, or approval-history responses publicly.
6. Every new database table must have RLS enabled and a deliberate access model.
7. Every mutation that can be retried must be idempotent or guarded against
   duplicate effects.
8. Do not silently swallow errors. Return an explicit error and log the
   server-side failure using the repository's existing patterns.

## Phase 0: Baseline and inventory

### Goal

Measure current behavior and create a reliable baseline before changing runtime,
cache, or database behavior.

### Inspect

- `src/proxy.ts`
- `src/lib/session.ts`
- `src/lib/supabase/admin.ts`
- `src/app/api/**/route.ts`
- `supabase/schema.sql`
- `vercel.json`
- `package.json`

Classify routes into:

1. Public cacheable GET
2. Public write or abuse-sensitive
3. Authenticated member
4. Admin/lead
5. Cron/device secret
6. Node-only external integration
7. Candidate Edge route

### Record

For representative routes, record:

- Cold and warm response time
- Response size
- Supabase query count
- External request count
- Error and timeout behavior
- Whether the route can safely be retried

Use request IDs in temporary local instrumentation if needed. Do not commit
temporary logs or profiling artifacts.

### Done when

- A route inventory exists in the agent's task notes or issue.
- Baseline measurements exist for public content, login, signup, dashboard data,
  attendance tap, and at least one recruitment endpoint.
- No production behavior has changed.

## Phase 1: Production configuration and abuse baseline

### Goal

Remove unsafe production fallbacks and protect the highest-risk endpoints before
optimizing throughput.

### Required changes

1. Fail closed in production when these are missing:
   - `JWT_SECRET`
   - `RECRUIT_JWT_SECRET`
   - `CRON_SECRET`
   - `ATTENDANCE_DEVICE_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Remove any production-capable default credential path such as `admin/admin`.
3. Keep local development fallbacks only behind an explicit development check.
4. Add request body-size limits to public JSON and upload endpoints.
5. Validate public input with existing Zod patterns or a small shared schema.
6. Add timeouts to external HTTP requests using `AbortController`.

### High-priority endpoints

- `/api/admin/login`
- `/api/member/signup`
- `/api/member/forgot-password`
- `/api/member/reset-password`
- `/api/recruit/auth/send-otp`
- `/api/recruit/auth/verify-otp`
- `/api/recruit/verify-email/send-otp`
- `/api/recruit/verify-email/verify-otp`
- `/api/recruit/public-chat`
- `/api/contact`
- `/api/payment/submit-manual-registration`
- `/api/attendance/tap`
- `/api/cron/*`

### Done when

- Missing production secrets produce an explicit deployment/startup failure.
- Invalid input is rejected before expensive bcrypt, SMTP, AI, or database work.
- External calls have bounded timeouts.
- Typecheck and build pass.

## Phase 2: Distributed rate limiting

### Goal

Use a shared rate-limit store so limits work across Vercel/serverless instances.

### Preferred design

Use a Redis-compatible provider such as Upstash Redis with a pinned package
version. Do not use Supabase row insertion as the hot-path limiter for every
request. Supabase can be used for durable audit records, not high-frequency
counters.

Create one helper:

```text
src/lib/rate-limit.ts
```

The helper should return:

```ts
{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}
```

It must fail explicitly if the limiter is unavailable. Choose deliberately
between fail-open and fail-closed per endpoint; authentication, OTP, password
reset, and public AI endpoints should not silently lose protection.

### Initial policies

| Endpoint group | Key dimensions | Limit |
| --- | --- | --- |
| Admin/member login | IP and normalized username | 5 per 15 minutes |
| Signup | IP and normalized email | 3 per hour |
| OTP send | IP and email | 3 per 15 minutes |
| OTP verify | IP and email | 5 per 15 minutes |
| Password reset | IP and email | 3 per hour |
| Public chat | IP | 10 per minute |
| Contact | IP and email | 5 per hour |
| Manual registration/payment | IP and email | 5 per hour |
| Uploads | authenticated identity | 10 per hour |
| Attendance tap | device ID and UID | conservative device limit |

### Response requirements

Return HTTP `429` with:

- A generic user-facing message
- `Retry-After`
- Optional rate-limit headers that do not disclose sensitive account state

Do not reveal whether an email/account exists through rate-limit responses.

### Done when

- Existing route-specific rate-limit logic is consolidated or intentionally
  retained with documented reasons.
- Limits work across separate processes/instances.
- Tests cover allowed, blocked, reset-window, and limiter-error behavior.
- Abuse-sensitive routes cannot be bypassed by changing only the email field.

## Phase 3: Public caching and CDN efficiency

### Goal

Reduce repeated Supabase reads for public marketing content without leaking
private data.

### Candidate resources

- `/api/content/members`
- `/api/content/projects`
- `/api/content/achievements`
- `/api/content/events`
- `/api/content/alumni`
- `/api/content/gallery`
- Public blog reads
- Public recruitment table data, if it contains no private information

### Implementation rules

1. Select explicit columns instead of `select("*")`.
2. Add short CDN/browser caching only to public GET responses.
3. Use `stale-while-revalidate` where appropriate.
4. Invalidate affected paths/tags after admin mutations.
5. Preserve the existing static fallback behavior.
6. Keep all authenticated or member-specific responses `private` and
   `no-store`.

Suggested starting policy:

```text
public content: s-maxage=60, stale-while-revalidate=300
public immutable assets: long cache with content-hashed names
authenticated/admin data: private, no-store
```

Do not cache responses containing contact submissions, attendance identities,
member profile data, approval history, or dashboard data.

### Done when

- Public content has measurable cache hits.
- Admin edits become visible after the chosen invalidation window.
- Personalized responses never receive a public cache header.
- Supabase query volume decreases without stale data exceeding the agreed window.

## Phase 4: Database query and pagination optimization

### Goal

Prevent large result sets, N+1 queries, and unindexed moderation/dashboard
queries.

### Required patterns

- Cap every client-provided limit.
- Prefer cursor pagination over offset pagination for changing datasets.
- Use stable ordering with a unique tie-breaker.
- Select only columns rendered or used by the route.
- Run independent reads with `Promise.all`.
- Create one Supabase client per request and pass it to helpers.
- Keep writes sequential when one write depends on another.
- Avoid joining large payloads when a denormalized display field is enough.

### Audit candidates

- Recruitment list, analytics, export, queue, and attendance endpoints
- Bazaar activity and request lists
- Blogs, content edits, leave requests, and contact messages
- Attendance history and team board
- Member approvals

### Index procedure

1. Inspect existing indexes in the live database.
2. Identify actual `WHERE`, `JOIN`, and `ORDER BY` patterns.
3. Use partial/composite indexes only where query patterns justify them.
4. Review index write/storage overhead.
5. Verify with `EXPLAIN (ANALYZE, BUFFERS)` in a safe environment.
6. Apply a focused migration, not the entire schema file.

Potential examples to validate, not blindly apply:

```sql
create index if not exists content_edits_pending_idx
  on content_edits (created_at desc)
  where status = 'pending';

create index if not exists blogs_pending_idx
  on blogs (created_at desc)
  where status = 'pending';

create index if not exists leave_requests_pending_idx
  on leave_requests (created_at desc)
  where status = 'pending';
```

### Done when

- Large endpoints paginate.
- Query plans show indexes used for the important filters/orderings.
- Response payloads are smaller.
- No endpoint can request an unbounded dataset accidentally.

## Phase 5: Runtime and Edge adoption

### Goal

Move only compatible lightweight routes to Edge while keeping integrations on
Node.js.

### Good Edge candidates

- Small public GET APIs
- JWT-only lightweight authorization
- Stateless JSON transformations
- Public content reads after dependency review

### Keep on Node.js

- Nodemailer and SMTP
- Google Sheets and `googleapis`
- bcrypt-heavy authentication
- Puppeteer/Chromium
- XLSX/XLS exports and parsing
- QR generation if it depends on Node APIs
- Large file processing
- Routes using Node-only SDKs

For each candidate:

1. Check every transitive import.
2. Add `export const runtime = "edge"` only to that route.
3. Run `npx tsc --noEmit`.
4. Run `npm run build`.
5. Test cold and warm requests.
6. Confirm Supabase client behavior in Edge runtime.
7. Revert the runtime declaration if any dependency is incompatible.

Do not convert the entire app or all API routes in one change.

## Phase 6: Background work and idempotency

### Goal

Remove slow external work from user-facing request latency and make retries safe.

### Move to jobs/queues

- Bulk recruitment email
- Approval and verification email delivery where reliability matters
- Workshop ticket email
- Large exports
- AI calls that do not need synchronous responses
- Long Google Sheets operations

Use a durable job record or queue. Do not rely on an unawaited promise after
returning a serverless response.

### Idempotency candidates

- Manual payment registration
- Ticket generation
- Attendance taps
- Approval decisions
- Email job creation
- Recruitment status transitions

An idempotency key should be scoped to the operation and actor, stored
durably, and have a clear retention period.

### Done when

- Retried requests do not duplicate tickets, attendance logs, approvals, or
  emails.
- Slow external work is observable and retryable.
- User-facing p95 latency improves.

## Phase 7: Observability and load verification

### Goal

Detect regressions after optimization and verify the limits under realistic load.

Track, without secrets or sensitive payloads:

- Request ID
- Route and method
- Status code
- Duration
- Supabase query duration/count
- External dependency duration/status
- Rate-limit result
- Cold-start indicator where available

Alert on:

- 5xx increases
- 429 spikes
- Supabase latency/errors
- SMTP/Google/API timeouts
- Authentication failures
- Attendance device failures

Load-test only against a staging project or controlled test endpoints. Never
load-test production registration, login, OTP, attendance, or payment routes
without explicit approval.

## Agent handoff checklist

Before starting a phase, an agent must:

- Read this document.
- Read the relevant route and helper files.
- Check current `git status`.
- Search for existing prior art before adding a helper.
- Confirm whether a schema change is required.
- Avoid modifying unrelated dirty files.

Before completing a phase, an agent must:

- Run the smallest relevant validation.
- Run `npx tsc --noEmit` for TypeScript changes.
- Run `npm run build` for runtime, caching, or route-boundary changes.
- Review `git diff --check`.
- Report changed files, validation, risks, and any required deployment/env steps.

## Suggested execution order

1. Phase 0: baseline and route inventory
2. Phase 1: production secret and request guardrails
3. Phase 2: distributed rate limiting
4. Phase 3: public caching
5. Phase 4: pagination and indexes
6. Phase 5: selective Edge runtime adoption
7. Phase 6: background jobs and idempotency
8. Phase 7: observability and load verification

