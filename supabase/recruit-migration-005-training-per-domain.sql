-- Migration 005 — training attendance becomes per-day-per-domain, with no
-- lead-created session step.
--
-- Safe to run more than once (every statement is guarded).
--
-- Why: training runs domain by domain, and in practice a volunteer just shows up,
-- picks their domain, and starts scanning. The old flow required a lead to pre-create
-- a named `recruit_training_sessions` row first, and the scanner refused to start
-- until one existed — a hard dependency on someone else being online at the right
-- moment, which is exactly the kind of thing that fails on a real training day.
--
-- The sessions table is KEPT rather than dropped: it is what
-- src/app/api/recruit/me/route.ts counts to build the attendance denominator
-- ("Day 3 / 5"), and what the admin training page lists. What changes is that a row
-- is now created implicitly by the first scan of the day for a domain, keyed by
-- (cycle_id, session_date, sub_domain), instead of by hand.
--
-- ---------------------------------------------------------------------------
-- 1. recruit_training_sessions.sub_domain
-- ---------------------------------------------------------------------------
-- Nullable on purpose. NULL means "a session for everyone", which is what every
-- pre-existing row is (they were created before training was domain-scoped), and
-- leaves room for an all-hands training day that isn't tied to one domain.

alter table recruit_training_sessions
  add column if not exists sub_domain recruit_subdomain;

-- ---------------------------------------------------------------------------
-- 2. One session per (cycle, day, domain)
-- ---------------------------------------------------------------------------
-- This is the arbiter for the scan route's find-or-create upsert. Without it, two
-- volunteers scanning the same domain at the same moment would each insert a session
-- row for that day and the attendance denominator would double-count the day.
--
-- A unique INDEX (not constraint) so it can be created concurrently later if this
-- table ever grows; ON CONFLICT (cycle_id, session_date, sub_domain) resolves against
-- it either way.
--
-- NULLs are DISTINCT here (Postgres default), so the legacy all-hands rows described
-- above are unaffected and several can coexist on one date. The scan route always
-- supplies a concrete sub_domain, so its upsert always has a real arbiter.
create unique index if not exists recruit_training_sessions_cycle_date_domain_key
  on recruit_training_sessions (cycle_id, session_date, sub_domain);

-- ---------------------------------------------------------------------------
-- 3. Supporting index
-- ---------------------------------------------------------------------------
-- /api/recruit/me filters sessions by cycle and session_date <= today on every
-- dashboard load, and the admin training page lists a cycle's sessions newest-first.
create index if not exists recruit_training_sessions_cycle_date_idx
  on recruit_training_sessions (cycle_id, session_date desc);

-- Attendance is read per session (who attended this day) and per recruit (my
-- attendance across the cycle). The second is already covered by the recruit_id FK
-- index; this covers the first.
create index if not exists recruit_training_attendance_session_idx
  on recruit_training_attendance (session_id);
