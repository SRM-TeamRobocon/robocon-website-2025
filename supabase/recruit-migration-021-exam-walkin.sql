-- Migration 021 — walk-in exam attendance (catch-up sittings on interview day).
--
-- Why: a recruit who already selected a domain but missed BOTH scheduled exam days can be
-- given one more chance to write it, typically during interview day. That is a different
-- situation from a normal Day 1 / Day 2 scan — there is no "day" it corresponds to — so
-- `day` becomes nullable and `is_walkin` records which kind of sitting this row is.
--
-- The unique key (recruit_id, cycle_id, sub_domain) is untouched: a walk-in sitting still
-- inserts into the exact same table via the exact same "already scanned" guard normal exam
-- attendance uses, so a recruit who already sat Day 1/Day 2 cannot also be walked in, and a
-- walk-in cannot be double-scanned. Eligibility (must have selected the domain) is enforced
-- in the API, unchanged from Day 1/Day 2 — walk-in only changes WHEN the exam was sat, not
-- WHETHER the recruit was allowed to sit it.
--
-- CHECK enforces the pairing is never ambiguous: a walk-in row always has day = null, a
-- normal row always has day in (1, 2). Never both null and non-walk-in, or a real day
-- number tagged as a walk-in.
--
-- Safe to re-run.

alter table recruit_exam_attendance
  add column if not exists is_walkin boolean not null default false;

alter table recruit_exam_attendance
  alter column day drop not null;

do $$ begin
  alter table recruit_exam_attendance
    drop constraint if exists recruit_exam_attendance_day_check;
exception when undefined_object then null; end $$;

do $$ begin
  alter table recruit_exam_attendance
    add constraint recruit_exam_attendance_day_check
    check (day is null or day in (1, 2));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table recruit_exam_attendance
    add constraint recruit_exam_attendance_walkin_day_pairing
    check (
      (is_walkin = true and day is null)
      or (is_walkin = false and day in (1, 2))
    );
exception when duplicate_object then null; end $$;
