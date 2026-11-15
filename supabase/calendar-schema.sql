-- =====================================================================
-- Calendar Feature Schema Migration: Events & Birthdays
-- Version: 1.0.0
-- Scope: Strictly limited to calendar_* objects only.
-- Security: RLS enabled with no public policies.
--   All access goes through Next.js API routes using the service-role
--   key, which bypasses RLS. JWT session + requireRole() enforces auth.
--   This matches the security pattern of all other protected tables
--   in this project (member_accounts, leave_requests, etc.).
-- =====================================================================

-- 1. Calendar-specific trigger function (uniquely namespaced)
--    CREATE OR REPLACE is safe: only affects calendar_set_updated_at().
--    Does not touch any existing unrelated functions.
create or replace function calendar_set_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
-- 2. Table: calendar_events
-- =====================================================================
create table if not exists calendar_events (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null check (char_length(trim(title)) > 0),
  description text,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  category    text        not null check (category in (
                'Meeting', 'Competition', 'Workshop',
                'Deadline', 'Team Activity', 'Other'
              )),
  location    text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint calendar_events_dates_valid check (end_at >= start_at)
);

create index if not exists calendar_events_start_at_idx    on calendar_events (start_at);
create index if not exists calendar_events_end_at_idx      on calendar_events (end_at);
create index if not exists calendar_events_category_idx    on calendar_events (category);
create index if not exists calendar_events_created_by_idx  on calendar_events (created_by);

drop trigger if exists calendar_events_updated_at_trg on calendar_events;
create trigger calendar_events_updated_at_trg
  before update on calendar_events
  for each row execute function calendar_set_updated_at();

-- =====================================================================
-- 3. Table: calendar_birthdays
-- =====================================================================
create table if not exists calendar_birthdays (
  id            uuid  primary key default gen_random_uuid(),
  name          text  not null check (char_length(trim(name)) > 0),
  date_of_birth date  not null,
  description   text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists calendar_birthdays_dob_idx         on calendar_birthdays (date_of_birth);
create index if not exists calendar_birthdays_created_by_idx  on calendar_birthdays (created_by);

drop trigger if exists calendar_birthdays_updated_at_trg on calendar_birthdays;
create trigger calendar_birthdays_updated_at_trg
  before update on calendar_birthdays
  for each row execute function calendar_set_updated_at();

-- =====================================================================
-- 4. Row Level Security
--    RLS is enabled on both tables. No public policies are defined.
--    The service-role key used by API routes bypasses RLS entirely.
--    Anonymous / public key access is blocked by default.
-- =====================================================================
alter table calendar_events    enable row level security;
alter table calendar_birthdays enable row level security;
