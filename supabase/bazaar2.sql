-- =============================================================================
-- SRM Team Robocon — Siesed Bazaar Migration 2 (bazaar2.sql)
-- Safe upgrade script for database that already executed bazaar.sql
-- Paste and run this in Supabase Project -> SQL Editor
-- =============================================================================

-- 1. Upgrade bazaar_requests table for unlisted/custom component borrowing
alter table bazaar_requests
  alter column item_id drop not null;

alter table bazaar_requests
  add column if not exists custom_item_name text;

alter table bazaar_requests
  drop constraint if exists bazaar_requests_item_check;

alter table bazaar_requests
  add constraint bazaar_requests_item_check
  check (
    item_id is not null or
    (custom_item_name is not null and trim(custom_item_name) <> '')
  );

-- 2. Drop old overloads of bazaar_create_request to prevent parameter signature conflicts
drop function if exists bazaar_create_request(text,text,text,text,uuid,int,text,text,date,date,text,text,int,int);
drop function if exists bazaar_create_request(text,text,text,text,uuid,text,int,text,text,date,date,text,text,int,int);

-- 3. Recreate bazaar_create_request supporting unlisted items and zero-stock requests
create or replace function bazaar_create_request(
  p_member_id text,
  p_member_name text,
  p_member_email text default null,
  p_member_reg text default null,
  p_item uuid default null,
  p_custom_item text default null,
  p_quantity int default 1,
  p_purpose text default null,
  p_project text default null,
  p_taking date default null,
  p_return date default null,
  p_usage_location text default 'in_lab',
  p_location_details text default null,
  p_max_active int default 99999,
  p_max_days int default 365
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_item        bazaar_items;
  v_taking_date date;
  v_return_date date;
  v_id          uuid;
begin
  -- Validate that either a catalog item or custom item name is provided
  if p_item is null and (p_custom_item is null or trim(p_custom_item) = '') then
    raise exception 'BAZAAR_VALIDATION: Component name or item selection is required';
  end if;

  if p_item is not null then
    select * into v_item from bazaar_items where id = p_item;
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'BAZAAR_INVALID_QUANTITY';
  end if;

  v_taking_date := coalesce(p_taking, bazaar_today());
  v_return_date := coalesce(p_return, v_taking_date + interval '7 days');

  if v_taking_date < bazaar_today() or v_return_date < v_taking_date then
    raise exception 'BAZAAR_INVALID_DATES';
  end if;

  -- Insert request (never blocks on 0 stock; supports unlisted items)
  insert into bazaar_requests
    (item_id, custom_item_name, member_id, member_name, member_email, member_reg_number,
     quantity, purpose, project_name, taking_date, expected_return_date,
     usage_location, location_details)
  values
    (p_item, nullif(trim(p_custom_item), ''), p_member_id, p_member_name,
     nullif(trim(p_member_email), ''), nullif(trim(p_member_reg), ''),
     p_quantity, coalesce(nullif(trim(p_purpose), ''), 'Lab borrow'),
     nullif(trim(p_project), ''), v_taking_date, v_return_date,
     coalesce(p_usage_location, 'in_lab'), nullif(trim(p_location_details), ''))
  returning id into v_id;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (v_id, p_item, 'member:' || p_member_id, 'request_created',
          jsonb_build_object(
            'item_name', coalesce(v_item.name, p_custom_item),
            'quantity', p_quantity,
            'taking_date', v_taking_date,
            'expected_return_date', v_return_date,
            'usage_location', coalesce(p_usage_location, 'in_lab')
          ));
  return v_id;
end $$;

-- 4. Update approval function (handles catalog items and unlisted items)
create or replace function bazaar_approve_request(
  p_request uuid, p_actor text, p_note text default null, p_issue boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_req  bazaar_requests;
  v_item bazaar_items;
begin
  select * into v_req from bazaar_requests where id = p_request for update;
  if not found then raise exception 'BAZAAR_NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'BAZAAR_INVALID_STATE'; end if;

  if v_req.item_id is not null then
    select * into v_item from bazaar_items where id = v_req.item_id for update;

    if p_issue then
      update bazaar_items
         set total_quantity  = greatest(total_quantity, reserved_quantity + issued_quantity + v_req.quantity + damaged_quantity),
             issued_quantity = issued_quantity + v_req.quantity
       where id = v_item.id;
    else
      update bazaar_items
         set total_quantity    = greatest(total_quantity, reserved_quantity + v_req.quantity + issued_quantity + damaged_quantity),
             reserved_quantity = reserved_quantity + v_req.quantity
       where id = v_item.id;
    end if;
  end if;

  if p_issue then
    update bazaar_requests
       set status = 'issued', decided_by = p_actor, decided_at = now(), decision_note = p_note,
           issued_by = p_actor, issued_at = now()
     where id = p_request;
  else
    update bazaar_requests
       set status = 'approved', decided_by = p_actor, decided_at = now(), decision_note = p_note
     where id = p_request;
  end if;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (p_request, v_req.item_id, p_actor, case when p_issue then 'approved_and_issued' else 'approved' end,
          jsonb_build_object('quantity', v_req.quantity, 'note', p_note));
end $$;

-- 5. Update reject function
create or replace function bazaar_reject_request(
  p_request uuid, p_actor text, p_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_req bazaar_requests;
begin
  select * into v_req from bazaar_requests where id = p_request for update;
  if not found then raise exception 'BAZAAR_NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'BAZAAR_INVALID_STATE'; end if;

  update bazaar_requests
     set status = 'rejected', decided_by = p_actor, decided_at = now(), decision_note = p_note
   where id = p_request;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (p_request, v_req.item_id, p_actor, 'rejected', jsonb_build_object('note', p_note));
end $$;

-- 6. Update issue handover function
create or replace function bazaar_issue_request(
  p_request uuid, p_actor text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_req bazaar_requests;
begin
  select * into v_req from bazaar_requests where id = p_request for update;
  if not found then raise exception 'BAZAAR_NOT_FOUND'; end if;
  if v_req.status <> 'approved' then raise exception 'BAZAAR_INVALID_STATE'; end if;

  if v_req.item_id is not null then
    perform 1 from bazaar_items where id = v_req.item_id for update;
    update bazaar_items
       set reserved_quantity = greatest(0, reserved_quantity - v_req.quantity),
           issued_quantity   = issued_quantity   + v_req.quantity
     where id = v_req.item_id;
  end if;

  update bazaar_requests set status = 'issued', issued_by = p_actor, issued_at = now() where id = p_request;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (p_request, v_req.item_id, p_actor, 'issued', jsonb_build_object('quantity', v_req.quantity));
end $$;

-- 7. Update cancel function
create or replace function bazaar_cancel_request(
  p_request uuid, p_actor text, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_req bazaar_requests;
begin
  select * into v_req from bazaar_requests where id = p_request for update;
  if not found then raise exception 'BAZAAR_NOT_FOUND'; end if;
  if v_req.status not in ('pending','approved') then raise exception 'BAZAAR_INVALID_STATE'; end if;

  if v_req.item_id is not null and v_req.status = 'approved' then
    perform 1 from bazaar_items where id = v_req.item_id for update;
    update bazaar_items set reserved_quantity = greatest(0, reserved_quantity - v_req.quantity) where id = v_req.item_id;
  end if;

  update bazaar_requests set status = 'cancelled', decision_note = coalesce(p_note, decision_note) where id = p_request;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (p_request, v_req.item_id, p_actor, 'cancelled',
          jsonb_build_object('was', v_req.status, 'note', p_note));
end $$;

-- 8. Update return function
create or replace function bazaar_return_request(
  p_request uuid, p_actor text, p_good int, p_damaged int, p_lost int, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_req bazaar_requests;
begin
  select * into v_req from bazaar_requests where id = p_request for update;
  if not found then raise exception 'BAZAAR_NOT_FOUND'; end if;
  if v_req.status <> 'issued' then raise exception 'BAZAAR_INVALID_STATE'; end if;
  if p_good < 0 or p_damaged < 0 or p_lost < 0 or (p_good + p_damaged + p_lost) <> v_req.quantity then
    raise exception 'BAZAAR_INVALID_QUANTITY';
  end if;

  if v_req.item_id is not null then
    perform 1 from bazaar_items where id = v_req.item_id for update;
    update bazaar_items
       set issued_quantity  = greatest(0, issued_quantity - v_req.quantity),
           damaged_quantity = damaged_quantity + p_damaged,
           total_quantity   = greatest(0, total_quantity - p_lost)
     where id = v_req.item_id;
  end if;

  update bazaar_requests
     set status = 'returned', returned_by = p_actor, returned_at = now(),
         returned_good_qty = p_good, returned_damaged_qty = p_damaged, returned_lost_qty = p_lost,
         return_note = p_note
   where id = p_request;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (p_request, v_req.item_id, p_actor, 'returned',
          jsonb_build_object('good', p_good, 'damaged', p_damaged, 'lost', p_lost, 'note', p_note));
end $$;

-- 9. Permissions
grant execute on function bazaar_create_request(text,text,text,text,uuid,text,int,text,text,date,date,text,text,int,int) to service_role;
grant execute on function bazaar_approve_request(uuid,text,text,boolean)  to service_role;
grant execute on function bazaar_reject_request(uuid,text,text)           to service_role;
grant execute on function bazaar_issue_request(uuid,text)                 to service_role;
grant execute on function bazaar_cancel_request(uuid,text,text)           to service_role;
grant execute on function bazaar_return_request(uuid,text,int,int,int,text) to service_role;
grant execute on function bazaar_adjust_stock(uuid,text,int,int,text)     to service_role;

-- 10. Seed Lab Categories (matches exact bazaar_categories schema: id, name, created_at)
insert into bazaar_categories (name)
values
  ('Electronics & Modules'),
  ('Motors & Actuators'),
  ('Batteries & Power'),
  ('Tools & Equipment'),
  ('Wires & Connectors'),
  ('Prototyping & General')
on conflict (name) do nothing;

-- 11. Seed Starter Lab Components from Google Sheet
do $$
declare
  cat_tools uuid;
  cat_wires uuid;
  cat_proto uuid;
  cat_elec  uuid;
  cat_motor uuid;
  cat_power uuid;
begin
  select id into cat_tools from bazaar_categories where name = 'Tools & Equipment';
  select id into cat_wires from bazaar_categories where name = 'Wires & Connectors';
  select id into cat_proto from bazaar_categories where name = 'Prototyping & General';
  select id into cat_elec  from bazaar_categories where name = 'Electronics & Modules';
  select id into cat_motor from bazaar_categories where name = 'Motors & Actuators';
  select id into cat_power from bazaar_categories where name = 'Batteries & Power';

  insert into bazaar_items (name, category_id, total_quantity, location, description)
  values
    ('Digital Multimeter', cat_tools, 5, 'Lab Shelf A - Tools Rack', 'Handheld digital multimeter for voltage, current, resistance testing'),
    ('ST-Link V2 Programmer / Debugger', cat_tools, 4, 'Lab Shelf A - Programmer Box', 'STM32 SWD in-circuit debugger and programmer'),
    ('Male to Female Jumper Wires (40 pcs)', cat_wires, 10, 'Lab Component Drawer 2', '20cm ribbon of 40 male-to-female jumper wires'),
    ('Male to Male Jumper Wires (40 pcs)', cat_wires, 10, 'Lab Component Drawer 2', '20cm ribbon of 40 male-to-male jumper wires'),
    ('Header Pin Strip (40-Pin Male)', cat_wires, 20, 'Lab Component Drawer 2', '2.54mm pitch single row breakaway male header pins'),
    ('Full Size Breadboard (830 Points)', cat_proto, 8, 'Lab Shelf B - Prototyping Bin', 'Solderless breadboard with power rails for rapid prototyping'),
    ('5V Single Channel Relay Module', cat_elec, 6, 'Lab Shelf C - Module Tray', 'High-current 10A 250VAC / 30VDC optical isolation relay module'),
    ('Cytron 20A Single Channel Motor Driver', cat_motor, 4, 'Lab Shelf D - Motor Drivers', 'MD20A high performance DC motor driver board'),
    ('ProRange DC Geared Motor 458 RPM', cat_motor, 4, 'Lab Shelf D - Motors Box', 'High torque planetary geared motor for drive base'),
    ('LiPo Battery 3S 11.1V / Lab Test Pack', cat_power, 4, 'Battery Storage Cabinet (Fireproof)', 'Rechargeable LiPo pack for robot power testing')
  on conflict do nothing;
end $$;
