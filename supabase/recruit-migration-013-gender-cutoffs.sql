-- Migration 013 — gender field + gender-scoped cutoffs.
--
-- 1. recruit_accounts.gender ('male' | 'female'), same checked-text-column pattern as
--    travel_method (see migration 012) rather than a Postgres enum — required for new
--    registrations at the application layer, nullable here so existing rows aren't broken.
--
-- 2. recruit_cutoffs becomes gender-scoped: cutoff_marks is now set separately per
--    (cycle_id, sub_domain, gender) instead of one value per domain. Every pre-existing
--    cutoff row (set gender-blind, before this migration) is widened into two rows — the
--    original row becomes 'male' in place, and a 'female' copy is inserted carrying the
--    SAME cutoff_marks forward unchanged, so a lead's prior work isn't wiped; they can
--    adjust either gender's value afterward. New unique key is
--    (cycle_id, sub_domain, gender), replacing (cycle_id, sub_domain).
--
-- Safe to re-run: guarded with IF NOT EXISTS / duplicate_object exceptions, and the
-- backfill INSERT is idempotent (won't double-insert 'female' rows on a second run).

alter table recruit_accounts add column if not exists gender text;

do $$ begin
  alter table recruit_accounts
    add constraint recruit_accounts_gender_valid
    check (gender is null or gender in ('male', 'female'));
exception when duplicate_object then null; end $$;

alter table recruit_cutoffs add column if not exists gender text;

-- Must drop the OLD (cycle_id, sub_domain) unique constraint before the backfill below —
-- otherwise inserting a 'female' row with the same (cycle_id, sub_domain) as the
-- soon-to-be-'male' original row violates it immediately.
alter table recruit_cutoffs drop constraint if exists recruit_cutoffs_cycle_id_sub_domain_key;

insert into recruit_cutoffs (cycle_id, sub_domain, cutoff_marks, set_by, set_at, gender)
select cycle_id, sub_domain, cutoff_marks, set_by, set_at, 'female'
from recruit_cutoffs src
where src.gender is null
  and not exists (
    select 1 from recruit_cutoffs f
    where f.cycle_id = src.cycle_id and f.sub_domain = src.sub_domain and f.gender = 'female'
  );

update recruit_cutoffs set gender = 'male' where gender is null;

alter table recruit_cutoffs alter column gender set not null;

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_gender_valid
    check (gender in ('male', 'female'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_cycle_sub_gender_key
    unique (cycle_id, sub_domain, gender);
exception when duplicate_object then null; end $$;
