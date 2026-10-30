> Preserved planning/discovery reference. Read [README.md](README.md) for current scope and use AGENTS.md for current UI rules. Do not rerun historical setup steps automatically.

# 02. Database

Cline: in Phase 1, create `supabase/bazaar.sql` containing the SQL in section 1 (adjust only for conflicts found
in Phase 0, and say what you changed). It is idempotent, so re-running is safe. Apply via the Supabase MCP
`apply_migration` if available; otherwise ask the user to run it in the SQL editor.

Design notes
- No auth or profile tables: authentication already exists. Requests store a **snapshot** of the requester
  (`member_id` as text, so it works whatever id format the existing auth uses, plus name/email/reg number).
- All access is server-side with the service role key. RLS is enabled on every table with **no client policies**
  (anon/authenticated clients can read or write nothing).
- Stock counters change only inside the `bazaar_*` functions, which lock rows (`FOR UPDATE`).
  Lock order is always **request row first, then item row**.
- Functions raise stable `BAZAAR_*` exception codes that the API maps to HTTP errors.
- "Today" is always IST.

## 1. SQL: `supabase/bazaar.sql`

```sql
-- =====================================================================
-- Bazaar: inventory + component requests. Idempotent; safe to re-run.
-- =====================================================================

-- ---------- helpers ----------
create or replace function bazaar_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function bazaar_set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- ---------- tables ----------
create table if not exists bazaar_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists bazaar_items (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 1 and 120),
  description         text,
  category_id         uuid references bazaar_categories(id) on delete set null,
  location            text,
  image_url           text,
  total_quantity      int not null default 0 check (total_quantity >= 0),
  reserved_quantity   int not null default 0 check (reserved_quantity >= 0),
  issued_quantity     int not null default 0 check (issued_quantity >= 0),
  damaged_quantity    int not null default 0 check (damaged_quantity >= 0),
  available_quantity  int generated always as
                        (total_quantity - reserved_quantity - issued_quantity - damaged_quantity) stored,
  low_stock_threshold int not null default 0 check (low_stock_threshold >= 0),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint bazaar_items_counters_ok
    check (reserved_quantity + issued_quantity + damaged_quantity <= total_quantity)
);
create unique index if not exists bazaar_items_name_uniq on bazaar_items (lower(name));
create index if not exists bazaar_items_category_idx on bazaar_items (category_id);

create table if not exists bazaar_requests (
  id                   uuid primary key default gen_random_uuid(),
  item_id              uuid not null references bazaar_items(id) on delete restrict,
  -- requester snapshot, taken from the EXISTING auth at request time
  member_id            text not null,
  member_name          text not null,
  member_email         text,
  member_reg_number    text,
  quantity             int not null check (quantity > 0),
  purpose              text not null check (char_length(purpose) >= 5),
  project_name         text,
  taking_date          date not null,
  expected_return_date date not null,
  status               text not null default 'pending'
                         check (status in ('pending','approved','rejected','issued','returned','cancelled')),
  decided_by           text,
  decided_at           timestamptz,
  decision_note        text,
  issued_by            text,
  issued_at            timestamptz,
  returned_by          text,
  returned_at          timestamptz,
  returned_good_qty    int check (returned_good_qty >= 0),
  returned_damaged_qty int check (returned_damaged_qty >= 0),
  returned_lost_qty    int check (returned_lost_qty >= 0),
  return_note          text,
  last_reminder_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint bazaar_requests_dates_ok check (expected_return_date >= taking_date)
);
create index if not exists bazaar_requests_status_idx on bazaar_requests (status);
create index if not exists bazaar_requests_member_idx on bazaar_requests (member_id);
create index if not exists bazaar_requests_item_idx   on bazaar_requests (item_id);
create index if not exists bazaar_requests_due_idx    on bazaar_requests (expected_return_date) where status = 'issued';

create table if not exists bazaar_activity_log (
  id         bigint generated always as identity primary key,
  request_id uuid references bazaar_requests(id) on delete set null,
  item_id    uuid references bazaar_items(id) on delete set null,
  actor      text not null,          -- '<role>:<id or username>' or 'system'
  action     text not null,          -- request_created, approved, approved_and_issued, rejected, issued, returned, cancelled, stock_adjusted, item_created, ...
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bazaar_activity_request_idx on bazaar_activity_log (request_id);
create index if not exists bazaar_activity_item_idx    on bazaar_activity_log (item_id);
create index if not exists bazaar_activity_created_idx on bazaar_activity_log (created_at desc);

-- ---------- updated_at triggers ----------
drop trigger if exists trg_bazaar_items_updated on bazaar_items;
create trigger trg_bazaar_items_updated before update on bazaar_items
  for each row execute function bazaar_set_updated_at();

drop trigger if exists trg_bazaar_requests_updated on bazaar_requests;
create trigger trg_bazaar_requests_updated before update on bazaar_requests
  for each row execute function bazaar_set_updated_at();

-- ---------- stock / workflow functions (server-only, service role) ----------

-- Create a pending request. Does NOT reserve stock.
create or replace function bazaar_create_request(
  p_member_id text, p_member_name text, p_member_email text, p_member_reg text,
  p_item uuid, p_quantity int, p_purpose text, p_project text,
  p_taking date, p_return date,
  p_max_active int default 5, p_max_days int default 30
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_item   bazaar_items;
  v_active int;
  v_id     uuid;
begin
  select * into v_item from bazaar_items where id = p_item and is_active;
  if not found then raise exception 'BAZAAR_ITEM_NOT_FOUND'; end if;

  if p_quantity is null or p_quantity < 1 then raise exception 'BAZAAR_INVALID_QUANTITY'; end if;
  if p_quantity > v_item.available_quantity then raise exception 'BAZAAR_INSUFFICIENT_STOCK'; end if;

  if p_taking < bazaar_today() or p_return < p_taking or (p_return - p_taking) > p_max_days then
    raise exception 'BAZAAR_INVALID_DATES';
  end if;

  select count(*) into v_active from bazaar_requests
   where member_id = p_member_id and status in ('pending','approved','issued');
  if v_active >= p_max_active then raise exception 'BAZAAR_LIMIT_REACHED'; end if;

  insert into bazaar_requests
    (item_id, member_id, member_name, member_email, member_reg_number,
     quantity, purpose, project_name, taking_date, expected_return_date)
  values
    (p_item, p_member_id, p_member_name, nullif(trim(p_member_email), ''), nullif(trim(p_member_reg), ''),
     p_quantity, p_purpose, nullif(trim(p_project), ''), p_taking, p_return)
  returning id into v_id;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (v_id, p_item, 'member:' || p_member_id, 'request_created',
          jsonb_build_object('quantity', p_quantity, 'taking_date', p_taking, 'expected_return_date', p_return));
  return v_id;
end $$;

-- Approve (reserve stock), optionally issuing immediately.
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

  select * into v_item from bazaar_items where id = v_req.item_id for update;
  if v_item.available_quantity < v_req.quantity then raise exception 'BAZAAR_INSUFFICIENT_STOCK'; end if;

  if p_issue then
    update bazaar_items set issued_quantity = issued_quantity + v_req.quantity where id = v_item.id;
    update bazaar_requests
       set status = 'issued', decided_by = p_actor, decided_at = now(), decision_note = p_note,
           issued_by = p_actor, issued_at = now()
     where id = p_request;
  else
    update bazaar_items set reserved_quantity = reserved_quantity + v_req.quantity where id = v_item.id;
    update bazaar_requests
       set status = 'approved', decided_by = p_actor, decided_at = now(), decision_note = p_note
     where id = p_request;
  end if;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (p_request, v_req.item_id, p_actor, case when p_issue then 'approved_and_issued' else 'approved' end,
          jsonb_build_object('quantity', v_req.quantity, 'note', p_note));
end $$;

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

-- Handover: approved -> issued
create or replace function bazaar_issue_request(
  p_request uuid, p_actor text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_req bazaar_requests;
begin
  select * into v_req from bazaar_requests where id = p_request for update;
  if not found then raise exception 'BAZAAR_NOT_FOUND'; end if;
  if v_req.status <> 'approved' then raise exception 'BAZAAR_INVALID_STATE'; end if;

  perform 1 from bazaar_items where id = v_req.item_id for update;
  update bazaar_items
     set reserved_quantity = reserved_quantity - v_req.quantity,
         issued_quantity   = issued_quantity   + v_req.quantity
   where id = v_req.item_id;

  update bazaar_requests set status = 'issued', issued_by = p_actor, issued_at = now() where id = p_request;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (p_request, v_req.item_id, p_actor, 'issued', jsonb_build_object('quantity', v_req.quantity));
end $$;

-- Cancel: pending or approved (the API enforces that members only cancel their own)
create or replace function bazaar_cancel_request(
  p_request uuid, p_actor text, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_req bazaar_requests;
begin
  select * into v_req from bazaar_requests where id = p_request for update;
  if not found then raise exception 'BAZAAR_NOT_FOUND'; end if;
  if v_req.status not in ('pending','approved') then raise exception 'BAZAAR_INVALID_STATE'; end if;

  if v_req.status = 'approved' then
    perform 1 from bazaar_items where id = v_req.item_id for update;
    update bazaar_items set reserved_quantity = reserved_quantity - v_req.quantity where id = v_req.item_id;
  end if;

  update bazaar_requests set status = 'cancelled', decision_note = coalesce(p_note, decision_note) where id = p_request;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (p_request, v_req.item_id, p_actor, 'cancelled',
          jsonb_build_object('was', v_req.status, 'note', p_note));
end $$;

-- Return: issued -> returned, with good/damaged/lost breakdown
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

  perform 1 from bazaar_items where id = v_req.item_id for update;
  update bazaar_items
     set issued_quantity  = issued_quantity - v_req.quantity,
         damaged_quantity = damaged_quantity + p_damaged,
         total_quantity   = total_quantity - p_lost
   where id = v_req.item_id;

  update bazaar_requests
     set status = 'returned', returned_by = p_actor, returned_at = now(),
         returned_good_qty = p_good, returned_damaged_qty = p_damaged, returned_lost_qty = p_lost,
         return_note = p_note
   where id = p_request;

  insert into bazaar_activity_log (request_id, item_id, actor, action, detail)
  values (p_request, v_req.item_id, p_actor, 'returned',
          jsonb_build_object('good', p_good, 'damaged', p_damaged, 'lost', p_lost, 'note', p_note));
end $$;

-- Lead stock adjustment.
--   purchase:           total_delta = +n,  damaged_delta = 0
--   write off damaged:  total_delta = -n,  damaged_delta = -n
--   repaired:           total_delta = 0,   damaged_delta = -n
create or replace function bazaar_adjust_stock(
  p_item uuid, p_actor text, p_total_delta int, p_damaged_delta int, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from bazaar_items where id = p_item for update;
  if not found then raise exception 'BAZAAR_NOT_FOUND'; end if;

  begin
    update bazaar_items
       set total_quantity   = total_quantity   + p_total_delta,
           damaged_quantity = damaged_quantity + p_damaged_delta
     where id = p_item;
  exception when check_violation then
    raise exception 'BAZAAR_INVALID_QUANTITY';
  end;

  insert into bazaar_activity_log (item_id, actor, action, detail)
  values (p_item, p_actor, 'stock_adjusted',
          jsonb_build_object('total_delta', p_total_delta, 'damaged_delta', p_damaged_delta, 'note', p_note));
end $$;

-- Only the server (service_role) may call these.
revoke all on function bazaar_create_request(text,text,text,text,uuid,int,text,text,date,date,int,int) from public, anon, authenticated;
revoke all on function bazaar_approve_request(uuid,text,text,boolean)  from public, anon, authenticated;
revoke all on function bazaar_reject_request(uuid,text,text)           from public, anon, authenticated;
revoke all on function bazaar_issue_request(uuid,text)                 from public, anon, authenticated;
revoke all on function bazaar_cancel_request(uuid,text,text)           from public, anon, authenticated;
revoke all on function bazaar_return_request(uuid,text,int,int,int,text) from public, anon, authenticated;
revoke all on function bazaar_adjust_stock(uuid,text,int,int,text)     from public, anon, authenticated;

grant execute on function bazaar_create_request(text,text,text,text,uuid,int,text,text,date,date,int,int) to service_role;
grant execute on function bazaar_approve_request(uuid,text,text,boolean)  to service_role;
grant execute on function bazaar_reject_request(uuid,text,text)           to service_role;
grant execute on function bazaar_issue_request(uuid,text)                 to service_role;
grant execute on function bazaar_cancel_request(uuid,text,text)           to service_role;
grant execute on function bazaar_return_request(uuid,text,int,int,int,text) to service_role;
grant execute on function bazaar_adjust_stock(uuid,text,int,int,text)     to service_role;

-- ---------- Row Level Security: ON, no policies = no direct client access ----------
alter table bazaar_categories   enable row level security;
alter table bazaar_items        enable row level security;
alter table bazaar_requests     enable row level security;
alter table bazaar_activity_log enable row level security;

-- ---------- Storage bucket for item photos (public read; uploads only via server) ----------
insert into storage.buckets (id, name, public)
values ('bazaar-items', 'bazaar-items', true)
on conflict (id) do nothing;

drop policy if exists "bazaar-items public read" on storage.objects;
create policy "bazaar-items public read" on storage.objects
  for select using (bucket_id = 'bazaar-items');
-- Cline: if supabase/schema.sql configures the existing buckets differently, mirror that instead.
```

## 2. Verification queries (run after applying; report the results)

```sql
-- 1) Tables exist
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like 'bazaar\_%' escape '\' order by 1;
-- expect: bazaar_activity_log, bazaar_categories, bazaar_items, bazaar_requests

-- 2) RLS on for all of them
select relname, relrowsecurity from pg_class
 where relname like 'bazaar\_%' escape '\' and relkind = 'r';
-- expect relrowsecurity = true everywhere

-- 3) Workflow functions callable only by service_role
select p.proname,
       has_function_privilege('anon',          p.oid, 'execute') as anon_can,
       has_function_privilege('authenticated', p.oid, 'execute') as authed_can,
       has_function_privilege('service_role',  p.oid, 'execute') as service_can
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'bazaar\_%' escape '\'
   and p.proname not in ('bazaar_today', 'bazaar_set_updated_at');
-- expect anon_can = false, authed_can = false, service_can = true

-- 4) Bucket exists
select id, public from storage.buckets where id = 'bazaar-items';
```

## 3. Optional smoke test (dev project only, never production data)

Seed one item with 1 unit and two pending requests. Approve the first (ok); approve the second, which must raise
`BAZAAR_INSUFFICIENT_STOCK`. Issue the first, then return it with good=0, damaged=1, lost=0 and confirm
`issued_quantity = 0`, `damaged_quantity = 1`, `available_quantity = 0`.

## 4. TypeScript types

`src/lib/bazaar/types.ts` mirrors these tables (snake_case as returned by Supabase) and exports:
`RequestStatus`, `BazaarCategory`, `BazaarItem`, `BazaarRequest`, `BazaarRequestWithItem`, `BazaarActivity`, `BazaarUser`
(the adapter's normalized user: `{ id, name, email?, regNumber?, role: 'lead' | 'viewer' | 'member' }`).
