-- Migration 012 — day-scholar residence details.
--
-- Adds two day-scholar-only fields, mirroring the existing hosteller-only
-- hostel_block/hostel_room pair: `day_scholar_area` (free text — the neighbourhood/locality
-- they live in, no fixed list since it can be anywhere in the city) and `travel_method`
-- (`'own_vehicle' | 'college_bus'`, a fixed 2-value set — kept as a checked text column
-- rather than a Postgres enum, same reasoning as `year`, so a third option can be added
-- later without an ALTER TYPE dance).
--
-- Both are required for NEW day-scholar registrations (enforced in
-- src/app/api/recruit/auth/complete-registration/route.ts), but deliberately NOT enforced
-- NOT NULL at the DB level on the day-scholar branch of the check constraint below —
-- existing day-scholar rows registered before this migration have neither field, and a
-- stricter constraint would break every future UPDATE to those rows. The DB only enforces
-- the half that's safe unconditionally: a HOSTELLER must never carry these fields.
--
-- Safe to re-run: guarded with IF NOT EXISTS / drop-if-exists before recreate.

alter table recruit_accounts
  add column if not exists day_scholar_area text;

alter table recruit_accounts
  add column if not exists travel_method text;

do $$ begin
  alter table recruit_accounts
    add constraint recruit_accounts_travel_method_valid
    check (travel_method is null or travel_method in ('own_vehicle', 'college_bus'));
exception when duplicate_object then null; end $$;

alter table recruit_accounts
  drop constraint if exists recruit_accounts_hostel_block_consistent;

do $$ begin
  alter table recruit_accounts
    add constraint recruit_accounts_residence_consistent
    check (
      (is_hosteller and hostel_block is not null and day_scholar_area is null and travel_method is null)
      or (not is_hosteller and hostel_block is null and hostel_room is null)
    );
exception when duplicate_object then null; end $$;
