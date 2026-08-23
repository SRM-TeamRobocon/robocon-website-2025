-- Migration 017 — track whether a recruit was emailed their ticket resolution.
--
-- Safe to run more than once.
--
-- Why: resolving a ticket now sends the recruit a Q&A email (see
-- src/app/api/admin/recruitment/tickets/[id]/resolve/route.ts). This column is the
-- idempotency guard for two things: (1) the resolve route itself, so a retried/duplicate
-- resolve request can't double-email, and (2) the one-off backfill script
-- (scripts/backfill-ticket-resolution-emails.ts) for tickets that were resolved before
-- this feature existed — it only targets rows where this is still null, so re-running it
-- after a partial failure never re-sends to recruits who already got theirs.

alter table recruit_tickets
  add column if not exists resolution_email_sent_at timestamptz;
