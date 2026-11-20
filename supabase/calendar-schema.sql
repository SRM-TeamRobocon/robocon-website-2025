-- =====================================================================
-- Calendar Feature Schema (v1.3.0)
-- Tables/objects touched: calendar_events, get_member_birthdays(),
--                         member_accounts.date_of_birth
-- Safe to re-run. Nothing is dropped or deleted (no data loss).
--
-- How events are saved:
--   Website "Add Event" -> Next.js API (service-role key) -> INSERT into
--   calendar_events. Rows stay until a DELETE is explicitly requested.
-- =====================================================================


-- 1. Trigger helper: keeps updated_at current ------------------------
create or replace function public.calendar_set_updated_at()
  returns trigger
  language plpgsql
  security invoker
  set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- 2. member_accounts.date_of_birth (must exist BEFORE the RPC below) --
alter table if exists member_accounts
  add column if not exists date_of_birth date;

create index if not exists member_accounts_dob_idx
  on member_accounts (date_of_birth);


-- 3. calendar_events table -------------------------------------------
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
  all_day     boolean     not null default false,
  -- Single foreign key (inline). If a member account is deleted, the event
  -- is kept and created_by becomes NULL.
  created_by  uuid        references member_accounts(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint calendar_events_dates_valid check (end_at >= start_at)
);

-- If the table already existed from an older version, add the new column.
alter table calendar_events
  add column if not exists all_day boolean not null default false;

-- Indexes for date-range queries, category filters, and creator lookups
create index if not exists calendar_events_start_at_idx   on calendar_events (start_at);
create index if not exists calendar_events_end_at_idx     on calendar_events (end_at);
create index if not exists calendar_events_category_idx   on calendar_events (category);
create index if not exists calendar_events_created_by_idx on calendar_events (created_by);

-- Auto-update updated_at on every edit
drop trigger if exists calendar_events_updated_at_trg on calendar_events;
create trigger calendar_events_updated_at_trg
  before update on calendar_events
  for each row execute function public.calendar_set_updated_at();

-- RLS on, no policies: only the service-role key (your API routes) can
-- read/write. Direct browser access with anon/authenticated keys sees nothing.
alter table calendar_events enable row level security;


-- 4. Birthday RPC (name + month/day only, no year or other PII) -------
create or replace function public.get_member_birthdays()
  returns table (
    member_account_id uuid,
    name              text,
    birth_month       smallint,
    birth_day         smallint
  )
  language sql
  security definer
  set search_path = public
as $$
  select
    id,
    name,
    extract(month from date_of_birth)::smallint,
    extract(day   from date_of_birth)::smallint
  from member_accounts
  where date_of_birth is not null;
$$;

-- Only the service-role key (your API) may call it.
revoke execute on function public.get_member_birthdays() from public;
revoke execute on function public.get_member_birthdays() from anon;
revoke execute on function public.get_member_birthdays() from authenticated;