-- Migration 020 — half marks. `recruit_marks.marks` and `recruit_cutoffs.cutoff_marks` go
-- from integer to numeric, so a paper scored 72.5 stops being rounded to 72 on entry.
--
-- Why numeric and not real/double precision: numeric is EXACT decimal. 72.5 stored as a
-- binary float is 72.5 exactly, but 0.1-style values are not, and the shortlist engine's
-- `marks >= cutoff` comparison must never flip on a representation error — a recruit sitting
-- exactly on the cutoff has to shortlist, every time, deterministically. numeric also makes
-- the half-step CHECK below exact rather than approximate.
--
-- Cutoffs move in lockstep on purpose. Leaving the bar an integer would mean 72.5 and 72.9
-- are indistinguishable at a cutoff of 72, so the decimals would stop mattering exactly where
-- they matter most — at the boundary.
--
-- The half-step CHECK ((x * 2) = trunc(x * 2)) enforces the "whole or half marks only" rule
-- agreed for this cycle. To allow arbitrary 2dp later, drop just those two constraints — the
-- numeric(5,2) column type already permits it, so no type change is needed.
--
-- Widening integer -> numeric is lossless and every existing row stays valid, so there is no
-- backfill. Safe to re-run: the type changes are no-ops once applied, and the constraints are
-- guarded.

alter table recruit_marks
  alter column marks type numeric(5, 2) using marks::numeric(5, 2);

alter table recruit_cutoffs
  alter column cutoff_marks type numeric(5, 2) using cutoff_marks::numeric(5, 2);

-- The 0-100 range checks survive the type change (they are type-agnostic comparisons), so
-- only the new half-step rule is added here.
do $$ begin
  alter table recruit_marks
    add constraint recruit_marks_half_step
    check ((marks * 2) = trunc(marks * 2));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_half_step
    check ((cutoff_marks * 2) = trunc(cutoff_marks * 2));
exception when duplicate_object then null; end $$;
