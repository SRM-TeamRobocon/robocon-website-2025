-- Collapses the interview check-in scan's "which open table for this domain has the
-- shortest line" step from 2 sequential round trips (fetch panels, then fetch waiting
-- counts per panel) into 1. See src/app/api/admin/recruitment/scan/route.ts.
create or replace function recruit_interview_open_panels(p_cycle_id uuid, p_sub_domain recruit_subdomain)
returns table(id uuid, domain_label text, table_number integer, waiting_count bigint)
language sql
stable
as $$
  select p.id, p.domain_label, p.table_number,
         count(t.id) filter (where t.status = 'waiting') as waiting_count
  from recruit_interview_panels p
  left join recruit_interview_tokens t on t.panel_id = p.id
  where p.cycle_id = p_cycle_id and p.sub_domain = p_sub_domain and p.is_active = true
  group by p.id, p.domain_label, p.table_number
  order by p.table_number asc;
$$;

-- Collapses token_number/queue_position allocation + the insert (previously 2 reads
-- + 1 write = up to 3 round trips per attempt) into 1 round trip. Same correctness
-- profile as before: a concurrent collision still raises the existing
-- (panel_id, token_number) unique_violation naturally from the INSERT, uncaught here,
-- so the caller's existing retry-on-23505 loop keeps working unchanged.
create or replace function recruit_allocate_interview_token(
  p_panel_id uuid,
  p_cycle_id uuid,
  p_recruit_id uuid,
  p_sub_domain recruit_subdomain,
  p_is_walkin boolean
)
returns table(token_number integer)
language plpgsql
as $$
declare
  v_token_number integer;
  v_queue_position double precision;
begin
  select coalesce(max(t.token_number), 0) + 1, coalesce(max(t.queue_position), 0) + 1000
    into v_token_number, v_queue_position
  from recruit_interview_tokens t
  where t.panel_id = p_panel_id;

  insert into recruit_interview_tokens
    (cycle_id, recruit_id, panel_id, sub_domain, token_number, queue_position, status, is_walkin)
  values
    (p_cycle_id, p_recruit_id, p_panel_id, p_sub_domain, v_token_number, v_queue_position, 'waiting', p_is_walkin);

  return query select v_token_number;
end;
$$;
