-- Apply once to an existing Supabase database to enable private per-member
-- attendance push subscriptions. The same table is included in schema.sql.
create table if not exists public.attendance_push_subscriptions (
  member_account_id uuid not null references public.member_accounts(id) on delete cascade,
  endpoint text not null check (length(endpoint) <= 2048),
  endpoint_hash text not null check (length(endpoint_hash) = 64),
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  created_at timestamptz not null default now(),
  primary key (endpoint_hash)
);
create index if not exists attendance_push_subscriptions_member_idx
  on public.attendance_push_subscriptions (member_account_id);

alter table public.attendance_push_subscriptions enable row level security;
revoke all on public.attendance_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.attendance_push_subscriptions to service_role;
