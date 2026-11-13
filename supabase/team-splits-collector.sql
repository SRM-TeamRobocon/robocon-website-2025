-- Apply after team-splits.sql. Existing requests keep their creator as collector.
begin;
alter table public.team_splits add column if not exists collector_member_id uuid;
alter table public.team_splits add column if not exists collector_name text;
grant delete on public.team_splits to service_role;
create index if not exists team_splits_collector_created_idx on public.team_splits (collector_member_id, created_at desc);
commit;
