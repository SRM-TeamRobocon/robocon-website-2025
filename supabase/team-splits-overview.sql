begin;
alter table public.team_splits add column if not exists due_date date;
create or replace function public.team_split_overview(p_actor_key text, p_member_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with shares as (
    select s.*, item,
      coalesce('member:' || s.collector_member_id::text, s.creator_key) = p_actor_key as collecting
    from public.team_splits s cross join lateral jsonb_array_elements(s.shares) item
    where s.status = 'open' and (s.creator_key = p_actor_key or s.collector_member_id = p_member_id or s.participant_ids @> array[p_member_id])
  )
  select jsonb_build_object(
    'owedPaise', coalesce(sum((item->>'amountPaise')::bigint) filter (where item->>'memberId' = p_member_id::text and item->>'status' = 'unpaid'), 0),
    'awaitingPaise', coalesce(sum((item->>'amountPaise')::bigint) filter (where item->>'memberId' = p_member_id::text and item->>'status' = 'reported'), 0),
    'collectingPaise', coalesce(sum((item->>'amountPaise')::bigint) filter (where collecting and item->>'status' <> 'confirmed'), 0),
    'reviewCount', count(*) filter (where collecting and item->>'status' = 'reported'),
    'reminderCount', count(*) filter (where item->>'memberId' = p_member_id::text and item->>'status' = 'unpaid' and item->>'remindedAt' is not null)
  ) from shares;
$$;
revoke all on function public.team_split_overview(text, uuid) from public, anon, authenticated;
grant execute on function public.team_split_overview(text, uuid) to service_role;
commit;
