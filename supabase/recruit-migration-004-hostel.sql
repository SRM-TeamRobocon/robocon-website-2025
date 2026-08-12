-- Migration 004 — hostel details on recruit_accounts.
--
-- Safe to run more than once (every statement is guarded).
--
-- Why: the team needs to reach recruits on campus during orientation/exam/training
-- days, and "which hostel + room" is the only reliable way to do that for residents.
-- Day scholars have no block/room, hence the boolean gate rather than a single
-- free-text field.
--
-- Shape mirrors the existing workshop registration form (src/app/workshopReg2), which
-- has collected the same hostel/room pair for years — except that form folds
-- "Day Scholar" into its block dropdown as a sentinel value. Here the boolean carries
-- that meaning instead, so `hostel_block` only ever holds a real block name.
--
-- `hostel_block` is plain text, not an enum: the block list changes between intakes
-- (new blocks, renames), and an enum would need a migration every time. The canonical
-- list lives in src/lib/hostel-blocks.ts and is enforced server-side at the write
-- boundary in the complete-registration route.

alter table recruit_accounts
  add column if not exists is_hosteller boolean not null default false,
  add column if not exists hostel_block text,
  add column if not exists hostel_room text;

-- A resident must have a block recorded, and a day scholar must not. Room is
-- deliberately NOT required here: a recruit may genuinely not know their room number
-- yet at registration time (allotment often lands later), and blocking registration on
-- that would be worse than a null.
do $$ begin
  alter table recruit_accounts
    add constraint recruit_accounts_hostel_block_consistent
    check (
      (is_hosteller and hostel_block is not null)
      or (not is_hosteller and hostel_block is null and hostel_room is null)
    );
exception when duplicate_object then null; end $$;
