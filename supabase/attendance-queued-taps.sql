-- Apply once before deploying the queued-tap API or flashing the new firmware.
-- Additive: leaves existing attendance history and legacy devices unchanged.
begin;

create table if not exists public.attendance_device_receipts (
  event_id text primary key check (event_id ~ '^[a-f0-9]{32}$'),
  device_id text not null check (length(device_id) between 1 and 64),
  uid text not null check (uid ~ '^([A-F0-9]{8}|[A-F0-9]{14}|[A-F0-9]{20})$'),
  scanned_at timestamptz,
  received_at timestamptz not null default now(),
  result jsonb not null
);
alter table public.attendance_device_receipts enable row level security;
revoke all on public.attendance_device_receipts from public, anon, authenticated;
grant select, insert on public.attendance_device_receipts to service_role;

-- Receipt and attendance write commit together. A lost HTTP reply is safe to retry.
create or replace function public.record_queued_attendance_tap(
  p_event_id text, p_device_id text, p_uid text, p_scanned_at timestamptz
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  receipt public.attendance_device_receipts%rowtype;
  account public.member_accounts%rowtype;
  pairing public.rfid_pairing_requests%rowtype;
  latest public.attendance_logs%rowtype;
  result jsonb;
  display_name text;
  display_domain text;
  tap_action text;
  boundary timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if p_event_id is null or p_event_id !~ '^[a-f0-9]{32}$'
    or p_device_id is null or length(p_device_id) not between 1 and 64
    or p_uid is null or p_uid !~ '^([A-F0-9]{8}|[A-F0-9]{14}|[A-F0-9]{20})$' then
    raise exception 'Invalid queued tap' using errcode = '22023';
  end if;
  -- One short transaction serialises new scanner requests, including card pairing.
  perform pg_advisory_xact_lock(hashtextextended('attendance-queued-tap', 0));
  select * into receipt from public.attendance_device_receipts where event_id = p_event_id;
  if found then
    if receipt.device_id <> p_device_id or receipt.uid <> p_uid
      or receipt.scanned_at is distinct from p_scanned_at then
      raise exception 'Event ID reused with different payload' using errcode = '22023';
    end if;
    return receipt.result || jsonb_build_object('duplicate', true);
  end if;

  -- Never guess a timestamp or insert an IN/OUT before a completed midnight sweep.
  if p_scanned_at is null or p_scanned_at < boundary or p_scanned_at > now() + interval '30 seconds' then
    result := jsonb_build_object('event', 'review', 'reason', 'clock_or_previous_day');
  else
    select * into account from public.member_accounts where rfid_uid = p_uid for update;
    if not found then
      -- Offline taps cannot claim a pairing window opened after they were scanned.
      select * into pairing from public.rfid_pairing_requests
        where status = 'pending' and expires_at > now()
          and date_trunc('milliseconds', created_at) <= p_scanned_at
          and p_scanned_at > now() - interval '15 seconds'
        order by created_at limit 1 for update;
      if not found then
        result := jsonb_build_object('event', 'unauthorized');
      else
        update public.member_accounts set rfid_uid = p_uid where id = pairing.member_account_id;
        update public.rfid_pairing_requests set status = 'claimed' where id = pairing.id;
        select * into account from public.member_accounts where id = pairing.member_account_id;
        select name into display_name from public.members where member_account_id = account.id limit 1;
        result := jsonb_build_object('event', 'linked', 'name', coalesce(display_name, account.name));
      end if;
    else
      select * into latest from public.attendance_logs where member_account_id = account.id
        order by occurred_at desc limit 1;
      if latest.occurred_at > p_scanned_at then
        result := jsonb_build_object('event', 'review', 'reason', 'later_attendance_exists');
      else
        select name, domain into display_name, display_domain from public.members
          where member_account_id = account.id limit 1;
        if latest.source = 'rfid' and p_scanned_at - latest.occurred_at < interval '3 seconds' then
          tap_action := latest.action;
        else
          tap_action := case when latest.action = 'IN' then 'OUT' else 'IN' end;
          insert into public.attendance_logs (member_account_id, action, source, device_id, occurred_at)
            values (account.id, tap_action, 'rfid', p_device_id, p_scanned_at);
        end if;
        result := jsonb_build_object('event', 'tap', 'action', tap_action,
          'name', coalesce(display_name, account.name),
          'domain', coalesce(display_domain, account.domain, 'GENERAL'), 'memberAccountId', account.id);
      end if;
    end if;
  end if;
  insert into public.attendance_device_receipts (event_id, device_id, uid, scanned_at, result)
    values (p_event_id, p_device_id, p_uid, p_scanned_at, result);
  return result;
end;
$$;
revoke all on function public.record_queued_attendance_tap(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_queued_attendance_tap(text, text, text, timestamptz) to service_role;

commit;
