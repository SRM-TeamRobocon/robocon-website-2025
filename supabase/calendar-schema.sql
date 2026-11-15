-- =====================================================================
-- Calendar Feature Schema Migration: Events & Birthdays
-- Completely isolated to calendar_* objects. Safe and idempotent.
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. Helper function for calendar updated_at trigger
create or replace function set_calendar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2. Table A: calendar_events
create table if not exists calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(trim(title)) > 0),
  description text,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  category    text not null check (category in ('Meeting', 'Competition', 'Workshop', 'Deadline', 'Team Activity', 'Other')),
  location    text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint calendar_events_dates_valid check (end_at >= start_at)
);

create index if not exists calendar_events_start_at_idx on calendar_events (start_at);
create index if not exists calendar_events_end_at_idx on calendar_events (end_at);
create index if not exists calendar_events_category_idx on calendar_events (category);
create index if not exists calendar_events_created_by_idx on calendar_events (created_by);

drop trigger if exists calendar_events_updated_at_trg on calendar_events;
create trigger calendar_events_updated_at_trg
  before update on calendar_events
  for each row execute function set_calendar_updated_at();

-- 3. Table B: calendar_birthdays
create table if not exists calendar_birthdays (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(trim(name)) > 0),
  date_of_birth date not null,
  description   text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists calendar_birthdays_dob_idx on calendar_birthdays (date_of_birth);
create index if not exists calendar_birthdays_created_by_idx on calendar_birthdays (created_by);

drop trigger if exists calendar_birthdays_updated_at_trg on calendar_birthdays;
create trigger calendar_birthdays_updated_at_trg
  before update on calendar_birthdays
  for each row execute function set_calendar_updated_at();

-- 4. Enable Row Level Security (RLS)
alter table calendar_events enable row level security;
alter table calendar_birthdays enable row level security;

-- Permissive policies for team access (API routes also enforce session role checks)
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'calendar_events' and policyname = 'calendar_events_all_access'
  ) then
    create policy calendar_events_all_access on calendar_events
      for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'calendar_birthdays' and policyname = 'calendar_birthdays_all_access'
  ) then
    create policy calendar_birthdays_all_access on calendar_birthdays
      for all using (true) with check (true);
  end if;
end;
$$;
