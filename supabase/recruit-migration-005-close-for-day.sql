-- Migration 005 — "Close for the Day" adds a distinct token status for recruits who
-- couldn't be redistributed when their table closed for good.
--
-- Safe to run more than once — ALTER TYPE ... ADD VALUE IF NOT EXISTS is idempotent.
--
-- Why: closing a table (PATCH .../close) has always been a reversible PAUSE — a lead can
-- Reopen it and any stranded `waiting` tokens are still sitting right there. "Close for the
-- Day" (PATCH .../close-for-day) is a different, non-reversible action: every recruit still
-- `waiting` on that table either gets moved onto another open table for the same domain, or,
-- if none is open, needs to be told "come back another day" — which is not the same thing as
-- `no_show` (they didn't fail to show up; there was nowhere left to send them) and not the
-- same as leaving them `waiting` forever on a table that will never call them again.

alter type interview_token_status add value if not exists 'deferred';
