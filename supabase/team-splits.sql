-- Additive migration. Custom dashboard sessions are checked in server API handlers.
begin;
create table if not exists public.team_splits (
  id uuid primary key default gen_random_uuid(),
  creator_key text not null check (length(creator_key) between 3 and 300),
  creator_name text not null,
  title text not null check (length(title) between 1 and 100),
  description text not null default '' check (length(description) <= 500),
  upi_id text not null,
  payee_name text not null,
  total_paise integer not null check (total_paise between 1 and 100000000),
  participant_ids uuid[] not null check (cardinality(participant_ids) between 1 and 100),
  shares jsonb not null check (jsonb_typeof(shares) = 'array' and jsonb_array_length(shares) = cardinality(participant_ids)),
  events jsonb not null default '[]'::jsonb check (jsonb_typeof(events) = 'array' and jsonb_array_length(events) <= 1000),
  status text not null default 'open' check (status in ('open', 'cancelled')),
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now()
);
alter table public.team_splits enable row level security;
revoke all on public.team_splits from public, anon, authenticated;
grant select, insert, update, delete on public.team_splits to service_role;
create index if not exists team_splits_creator_created_idx on public.team_splits (creator_key, created_at desc);
create index if not exists team_splits_participants_idx on public.team_splits using gin (participant_ids);
commit;
