-- Migration 001 — exam attendance becomes per sub-domain.
--
-- Why: a recruit can apply for up to 2 sub-domains. If both are exam domains
-- (e.g. coding + siesed) they sit two separate exams. The original key
-- (recruit_id, cycle_id, day) allowed only ONE attendance row per recruit per
-- day, so scanning them for their second exam hit the unique constraint and
-- silently returned "already scanned" — losing that attendance record and
-- making the Marks page show misleading per-day ticks.
--
-- After this migration attendance is keyed (recruit_id, cycle_id, sub_domain):
-- one row per exam the recruit actually sat. `day` is kept as metadata.
--
-- Safe to run once against an existing database. Only needed if you already ran
-- the original recruit-schema.sql; a fresh run of recruit-schema.sql already
-- includes the corrected shape.

alter table recruit_exam_attendance
  add column if not exists sub_domain recruit_subdomain;

-- Pre-flight: collapse duplicate rows that would map to the same
-- (recruit_id, cycle_id, sub_domain) after backfill — e.g. a recruit scanned on
-- both exam days for a domain that only counts as one attendance record under
-- the new model. Keep the earliest scan, drop the rest.
with backfilled as (
  select ea.id, ea.recruit_id, ea.cycle_id, sel.sub_domain, ea.scanned_at,
    row_number() over (
      partition by ea.recruit_id, ea.cycle_id, sel.sub_domain
      order by ea.scanned_at asc nulls last, ea.id
    ) as rn
  from recruit_exam_attendance ea
  join (
    select distinct on (recruit_id, cycle_id) recruit_id, cycle_id, sub_domain
    from recruit_domain_selections
    where sub_domain in ('coding', 'siesed', 'corporate', 'sambed')
    order by recruit_id, cycle_id, sub_domain
  ) sel on sel.recruit_id = ea.recruit_id and sel.cycle_id = ea.cycle_id
)
delete from recruit_exam_attendance ea
using backfilled b
where ea.id = b.id and b.rn > 1;

-- Backfill: attribute any pre-existing row to the recruit's first exam-domain
-- selection, so the not-null constraint below can be applied. Rows that can't be
-- attributed (recruit has no exam-domain selection) are deleted — they were
-- meaningless under the new model anyway.
update recruit_exam_attendance ea
set sub_domain = sel.sub_domain
from (
  select distinct on (recruit_id, cycle_id) recruit_id, cycle_id, sub_domain
  from recruit_domain_selections
  where sub_domain in ('coding', 'siesed', 'corporate', 'sambed')
  order by recruit_id, cycle_id, sub_domain
) sel
where ea.recruit_id = sel.recruit_id
  and ea.cycle_id = sel.cycle_id
  and ea.sub_domain is null;

delete from recruit_exam_attendance where sub_domain is null;

alter table recruit_exam_attendance
  alter column sub_domain set not null;

alter table recruit_exam_attendance
  drop constraint if exists recruit_exam_attendance_recruit_id_cycle_id_day_key;

do $$ begin
  alter table recruit_exam_attendance
    add constraint recruit_exam_attendance_recruit_cycle_subdomain_key
    unique (recruit_id, cycle_id, sub_domain);
exception when duplicate_table or duplicate_object then null; end $$;

-- OTP brute-force protection: without an attempt counter the 6-digit keyspace is
-- guessable inside the 15-minute validity window (bcrypt is the only brake, and
-- requests run concurrently). verify-otp burns the OTP after 5 wrong guesses.
alter table recruit_email_otps
  add column if not exists attempts integer not null default 0;
