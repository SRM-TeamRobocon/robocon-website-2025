-- Migration 002 — cycle activation safety + training session dedupe/cascade.
--
-- Fixes three audit findings:
--
-- 1. "Only one active cycle" was enforced only in application code (deactivate-all
--    then insert). Two concurrent creates produced TWO active cycles, which breaks
--    every `.single()` active-cycle lookup module-wide (PGRST116). A partial unique
--    index now makes that impossible at the DB level. Routes catch 23505 and report
--    a clear message. Re-activation is now possible via
--    PATCH /api/admin/recruitment/cycles/:id/activate.
--
-- 3. Training sessions had no dedupe key, so a double-clicked "Create Session"
--    inserted a duplicate that permanently dragged every attendance percentage
--    down, and there was no way to delete it. Adds a unique key and an ON DELETE
--    CASCADE from recruit_training_attendance so a session can actually be removed.
--
-- Safe to run once against a live database. Idempotent where Postgres allows it.

---------------------------------------------------------------------------
-- 1. recruitment_cycles — at most one active cycle, enforced by the DB
---------------------------------------------------------------------------

-- Pre-flight: if the pre-migration app code ever raced and left more than one
-- cycle active, the index below would fail to build. Keep the most recently
-- created active cycle and deactivate the rest.
update recruitment_cycles
set is_active = false
where is_active
  and id <> (
    select id from recruitment_cycles
    where is_active
    order by created_at desc nulls last, id desc
    limit 1
  );

create unique index if not exists recruitment_cycles_single_active
  on recruitment_cycles (is_active)
  where is_active;

---------------------------------------------------------------------------
-- 2. recruit_training_sessions — no duplicate sessions
---------------------------------------------------------------------------

-- Pre-flight: collapse any existing duplicates before adding the unique key.
-- Attendance rows pointing at a duplicate are re-pointed at the surviving
-- (oldest) session; rows that would collide with an existing attendance row for
-- the survivor are dropped, since (recruit_id, session_id) is already unique.
with ranked as (
  select
    id,
    first_value(id) over (
      partition by cycle_id, session_date, session_label
      order by created_at asc nulls last, id asc
    ) as keep_id
  from recruit_training_sessions
),
dupes as (
  select id, keep_id from ranked where id <> keep_id
)
update recruit_training_attendance a
set session_id = d.keep_id
from dupes d
where a.session_id = d.id
  and not exists (
    select 1 from recruit_training_attendance b
    where b.recruit_id = a.recruit_id and b.session_id = d.keep_id
  );

-- Anything still pointing at a duplicate session was a collision with the
-- survivor's row — the attendance fact is already recorded, drop the dupe row.
-- (The ON DELETE CASCADE below does not exist yet at this point, so this has to
-- be explicit.)
with ranked as (
  select
    id,
    row_number() over (
      partition by cycle_id, session_date, session_label
      order by created_at asc nulls last, id asc
    ) as rn
  from recruit_training_sessions
)
delete from recruit_training_attendance a
using ranked r
where a.session_id = r.id and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by cycle_id, session_date, session_label
      order by created_at asc nulls last, id asc
    ) as rn
  from recruit_training_sessions
)
delete from recruit_training_sessions s
using ranked r
where s.id = r.id and r.rn > 1;

do $$ begin
  alter table recruit_training_sessions
    add constraint recruit_training_sessions_cycle_date_label_key
    unique (cycle_id, session_date, session_label);
exception when duplicate_table or duplicate_object then null; end $$;

---------------------------------------------------------------------------
-- 3. recruit_training_attendance.session_id — ON DELETE CASCADE
---------------------------------------------------------------------------
-- Without this a training session can never be deleted while anyone is marked
-- present for it. The DELETE route also removes child rows explicitly (so it
-- works even before this migration runs), but the cascade is the real guarantee.

alter table recruit_training_attendance
  drop constraint if exists recruit_training_attendance_session_id_fkey;

do $$ begin
  alter table recruit_training_attendance
    add constraint recruit_training_attendance_session_id_fkey
    foreign key (session_id) references recruit_training_sessions(id) on delete cascade;
exception when duplicate_table or duplicate_object then null; end $$;

---------------------------------------------------------------------------
-- 4. Helpful indexes for the "sessions that have already happened" queries
---------------------------------------------------------------------------

create index if not exists recruit_training_sessions_cycle_date_idx
  on recruit_training_sessions (cycle_id, session_date);
