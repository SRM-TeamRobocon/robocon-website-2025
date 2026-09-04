-- Recruits no longer get auto-routed to a specific table at interview check-in. They wait
-- in one shared pool per domain (panel_id null), and any open table for that domain either
-- Call Nexts (oldest in the domain pool) or manually picks a specific recruit to call.
-- panel_id is only ever set once someone is actually called to a table.
alter table recruit_interview_tokens alter column panel_id drop not null;

-- Move today's already-waiting recruits into the shared pool immediately, so tables that
-- were siloed by the old auto-routing (the SAMBED incident) are fixed right now, not just
-- for new check-ins going forward. called/done/no_show tokens are untouched - those already
-- represent a real, meaningful table assignment.
update recruit_interview_tokens
set panel_id = null, queue_position = null
where status = 'waiting';

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
  if p_panel_id is null then
    -- Shared pool: token_number is scoped to the whole domain, not a table, since there is
    -- no table yet at check-in time. It is cosmetic at this point either way - call-next and
    -- call-token both allocate a FRESH, table-scoped token_number the moment someone is
    -- actually called to a specific panel.
    select coalesce(max(t.token_number), 0) + 1
      into v_token_number
    from recruit_interview_tokens t
    where t.cycle_id = p_cycle_id and t.sub_domain = p_sub_domain;
    v_queue_position := null;
  else
    select coalesce(max(t.token_number), 0) + 1, coalesce(max(t.queue_position), 0) + 1000
      into v_token_number, v_queue_position
    from recruit_interview_tokens t
    where t.panel_id = p_panel_id;
  end if;

  insert into recruit_interview_tokens
    (cycle_id, recruit_id, panel_id, sub_domain, token_number, queue_position, status, is_walkin)
  values
    (p_cycle_id, p_recruit_id, p_panel_id, p_sub_domain, v_token_number, v_queue_position, 'waiting', p_is_walkin);

  return query select v_token_number;
end;
$$;
