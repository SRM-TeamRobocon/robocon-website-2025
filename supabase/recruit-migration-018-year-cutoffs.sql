-- Migration 018 — year-scoped cutoffs, on top of the gender scoping from migration 013.
--
-- Why: 1st and 2nd years sit different papers for the same domain, so one pass mark per
-- (domain, gender) can't be right for both. cutoff_marks is now set per
-- (cycle_id, sub_domain, gender, year) — 4 values per domain instead of 2, 24 in total.
--
-- Every pre-existing gender-scoped row is widened into two year rows the same way 013
-- widened the gender-blind rows: the original row becomes year '1' in place, and a year '2'
-- copy is inserted carrying the SAME cutoff_marks forward unchanged, so a lead's prior work
-- isn't wiped and they can adjust either year afterward.
--
-- `year` mirrors recruit_accounts.year — a checked text column of '1'/'2' (tightened from
-- ('1','2','3') by migration 016), not an enum, so a future third year is a CHECK change
-- rather than an ALTER TYPE.
--
-- Safe to re-run: guarded with IF NOT EXISTS / duplicate_object exceptions, and the
-- backfill INSERT is idempotent (won't double-insert year '2' rows on a second run).

alter table recruit_cutoffs add column if not exists year text;

-- Must drop the (cycle_id, sub_domain, gender) unique constraint before the backfill —
-- otherwise inserting a year '2' row with the same (cycle_id, sub_domain, gender) as the
-- soon-to-be-year-'1' original row violates it immediately. Same ordering trap as 013.
alter table recruit_cutoffs drop constraint if exists recruit_cutoffs_cycle_sub_gender_key;

insert into recruit_cutoffs (cycle_id, sub_domain, cutoff_marks, gender, set_by, set_at, year)
select cycle_id, sub_domain, cutoff_marks, gender, set_by, set_at, '2'
from recruit_cutoffs src
where src.year is null
  and not exists (
    select 1 from recruit_cutoffs y2
    where y2.cycle_id = src.cycle_id
      and y2.sub_domain = src.sub_domain
      and y2.gender = src.gender
      and y2.year = '2'
  );

update recruit_cutoffs set year = '1' where year is null;

alter table recruit_cutoffs alter column year set not null;

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_year_valid
    check (year in ('1', '2'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_cycle_sub_gender_year_key
    unique (cycle_id, sub_domain, gender, year);
exception when duplicate_object then null; end $$;
