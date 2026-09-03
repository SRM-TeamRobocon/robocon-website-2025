-- Recruitment module schema. Run AFTER supabase/schema.sql.
-- Do NOT edit supabase/schema.sql — this file is additive and self-contained.
-- All tables are prefixed recruit_ (or recruitment_), carry cycle_id for multi-season support,
-- and have RLS enabled with NO public policies — every read/write goes through server-side
-- API routes using SUPABASE_SERVICE_ROLE_KEY (see src/lib/supabase/recruit-admin.ts).
--
-- This file is the CANONICAL end state of the recruitment schema — it folds in every
-- change previously shipped as recruit-migration-001..006-*.sql. Every statement below
-- is guarded (create table/index/type "if not exists", constraints wrapped in
-- `do $$ ... exception when duplicate_object/duplicate_table then null; end $$;`) so the
-- whole file is safe to re-run against a fresh database OR one that already has some or
-- all of these tables/columns/constraints in place.
--
-- A few blocks below are explicitly marked "one-time data migration" — these exist only
-- to clean up rows that could have been written under an OLDER shape of a table (e.g.
-- before a column existed, or before a uniqueness rule was enforced) before a constraint
-- that depends on that cleanup is added. On a brand-new database they are no-ops (there is
-- no data yet to clean up); they're kept here, not deleted, because `create table if not
-- exists` never alters a table that already exists in an older shape, so this file needs
-- to remain safe to run against a partially-seeded dev DB too.

create extension if not exists pgcrypto;

-- Enum types. Wrapped so this file can be re-run safely during development.
do $$ begin
  create type recruit_subdomain as enum (
    'coding', 'webdev', 'siesed', 'corporate', 'vfx_gfx', 'sambed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type shortlist_result as enum ('pending', 'shortlisted', 'not_shortlisted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interview_token_status as enum ('waiting', 'called', 'done', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interview_result as enum ('selected', 'rejected', 'waitlisted');
exception when duplicate_object then null; end $$;

---------------------------------------------------------------------------
-- recruitment_cycles
---------------------------------------------------------------------------

create table if not exists recruitment_cycles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  year         text not null,
  is_active    boolean not null default false,
  created_at   timestamptz default now(),
  closed_at    timestamptz
);

alter table recruitment_cycles enable row level security;

-- One-time data migration (originally migration 002): if application-level "deactivate
-- all, then insert" ever raced and left more than one cycle active, the partial unique
-- index below would fail to build. Keep the most recently created active cycle and
-- deactivate the rest before adding it. No-op on a fresh database.
update recruitment_cycles
set is_active = false
where is_active
  and id <> (
    select id from recruitment_cycles
    where is_active
    order by created_at desc nulls last, id desc
    limit 1
  );

-- At most one active cycle, enforced by the DB rather than only in application code —
-- two concurrent "create cycle" requests used to be able to produce two active cycles,
-- which breaks every `.single()` active-cycle lookup module-wide (PGRST116). Routes catch
-- 23505 and report a clear message; re-activation goes through
-- PATCH /api/admin/recruitment/cycles/:id/activate.
create unique index if not exists recruitment_cycles_single_active
  on recruitment_cycles (is_active)
  where is_active;

---------------------------------------------------------------------------
-- recruit_accounts
---------------------------------------------------------------------------

create table if not exists recruit_accounts (
  id                  uuid primary key default gen_random_uuid(),
  cycle_id            uuid not null references recruitment_cycles(id),
  google_uid          text,
  personal_email      text,
  srm_email           text not null,
  srm_email_verified  boolean not null default false,
  name                text not null,
  reg_no              text not null,
  -- '3' is still accepted here on purpose: registration now only OFFERS 1st and 2nd
  -- year (the dropdown in src/app/recruit/register/page.tsx), but earlier cycles
  -- recruited 3rd years and those rows must stay valid.
  year                text not null check (year in ('1', '2', '3')),
  department          text not null,
  course              text not null,
  phone               text,
  -- Hostel details. The team needs to reach recruits on campus during orientation/exam/
  -- training days, and "which hostel + room" is the only reliable way to do that for
  -- residents. Day scholars are (false, null, null); the check constraint below is what
  -- keeps a half-filled address out of the table. Room is deliberately NOT required even
  -- for hostellers: a recruit may genuinely not know their room number yet at
  -- registration time (allotment often lands later), and blocking registration on that
  -- would be worse than a null. `hostel_block` is plain text, not an enum: the block list
  -- changes between intakes (new blocks, renames), and an enum would need a migration
  -- every time — the canonical list lives in src/lib/hostel-blocks.ts and is enforced
  -- server-side at the write boundary in the complete-registration route.
  is_hosteller        boolean not null default false,
  hostel_block        text,
  hostel_room         text,
  -- Day-scholar-only counterparts to hostel_block/hostel_room (originally migration 012).
  -- `day_scholar_area` is free text (no fixed list — day scholars live all over the city,
  -- unlike the closed set of on-campus hostel blocks). `travel_method` is a checked text
  -- column rather than an enum, same reasoning as `year` below: a fixed 2-value set today
  -- ('own_vehicle' | 'college_bus') that might grow a third option later without an ALTER
  -- TYPE migration. Both are required for new day-scholar registrations at the application
  -- layer (complete-registration route) but NOT enforced NOT NULL here — see the
  -- residence-consistency constraint below for why.
  day_scholar_area    text,
  travel_method       text,
  -- Male/female (originally migration 013) — feeds gender-scoped cutoffs on
  -- recruit_cutoffs below. Same checked-text-column pattern as travel_method, nullable
  -- here for the same reason (existing rows predate this column); required for new
  -- registrations at the application layer.
  gender              text,
  portfolio_url       text,
  password_hash       text not null,
  is_selected         boolean not null default false,
  created_at          timestamptz default now(),
  -- Case-sensitive and deliberately kept alongside the case-insensitive expression index
  -- below even though it is strictly weaker (anything it rejects, that index also
  -- rejects) — dropping it would change the error surfaced to any future
  -- ON CONFLICT (srm_email, cycle_id) upsert. Nothing upserts this table today; the
  -- redundancy costs one extra index write per registration, which is nothing at this
  -- volume.
  unique (srm_email, cycle_id),
  -- Day scholars are (false, null, null, ?, ?); hostellers are (true, block, ?, null, null).
  -- Deliberately NOT requiring day_scholar_area/travel_method NOT NULL on the day-scholar
  -- branch — existing rows registered before migration 012 have neither, and a stricter
  -- constraint here would reject any future UPDATE to those rows. The DB only enforces the
  -- half that's safe unconditionally (a hosteller must never carry day-scholar fields);
  -- requiredness for new registrations is enforced in application code instead.
  constraint recruit_accounts_residence_consistent check (
    (is_hosteller and hostel_block is not null and day_scholar_area is null and travel_method is null)
    or (not is_hosteller and hostel_block is null and hostel_room is null)
  ),
  constraint recruit_accounts_travel_method_valid check (
    travel_method is null or travel_method in ('own_vehicle', 'college_bus')
  ),
  constraint recruit_accounts_gender_valid check (
    gender is null or gender in ('male', 'female')
  )
);

alter table recruit_accounts enable row level security;

-- Brings an already-existing recruit_accounts table (the CREATE TABLE above is a no-op
-- against it) up to the day-scholar-details shape added by migration 012. No-op on a
-- fresh database, where these columns/constraints already came from the CREATE TABLE.
alter table recruit_accounts add column if not exists day_scholar_area text;
alter table recruit_accounts add column if not exists travel_method text;

do $$ begin
  alter table recruit_accounts
    add constraint recruit_accounts_travel_method_valid
    check (travel_method is null or travel_method in ('own_vehicle', 'college_bus'));
exception when duplicate_object then null; end $$;

alter table recruit_accounts drop constraint if exists recruit_accounts_hostel_block_consistent;

do $$ begin
  alter table recruit_accounts
    add constraint recruit_accounts_residence_consistent
    check (
      (is_hosteller and hostel_block is not null and day_scholar_area is null and travel_method is null)
      or (not is_hosteller and hostel_block is null and hostel_room is null)
    );
exception when duplicate_object then null; end $$;

-- Same treatment for the gender column added by migration 013.
alter table recruit_accounts add column if not exists gender text;

do $$ begin
  alter table recruit_accounts
    add constraint recruit_accounts_gender_valid
    check (gender is null or gender in ('male', 'female'));
exception when duplicate_object then null; end $$;

-- `reg_no` had no uniqueness of any kind, so the same student could register twice (or
-- two students could claim one registration number) with nothing stopping it. Scoped to
-- cycle_id, not global: a student rejected in one intake must be able to apply again in
-- the next one, so uniqueness is "one registration per person per intake", not forever.
--
-- Expression indexes rather than plain unique constraints: they enforce the
-- case-insensitive rule at the storage layer, need no backfill of existing values, and
-- cannot be bypassed by application code that forgets to normalise. Case matters here in
-- practice, not just in theory — two real accounts in this table were spelled
-- `RA2531022010023` and `Ra2531022010000`; a plain unique constraint treats those as
-- different values and the duplicate it exists to prevent would sail straight through.
--
-- src/app/api/recruit/auth/complete-registration/route.ts inspects 23505 from these
-- indexes and returns a 409 naming the field that collided — keep that behaviour if the
-- insert is ever rewritten. This also closes a pre-existing race: a select-then-insert
-- pre-check lets two simultaneous submissions both pass the SELECT, and only the database
-- can reject the loser.
create unique index if not exists recruit_accounts_cycle_regno_key
  on recruit_accounts (cycle_id, upper(reg_no));

create unique index if not exists recruit_accounts_cycle_email_key
  on recruit_accounts (cycle_id, lower(srm_email));

---------------------------------------------------------------------------
-- recruit_domain_selections
---------------------------------------------------------------------------

create table if not exists recruit_domain_selections (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references recruitment_cycles(id),
  recruit_id  uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain  recruit_subdomain not null,
  created_at  timestamptz default now(),
  unique (recruit_id, sub_domain)
);

alter table recruit_domain_selections enable row level security;

---------------------------------------------------------------------------
-- recruit_email_otps
---------------------------------------------------------------------------

create table if not exists recruit_email_otps (
  id          uuid primary key default gen_random_uuid(),
  srm_email   text not null,
  otp_hash    text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  -- Wrong guesses; the OTP is burned after 5. Without this counter the 6-digit keyspace
  -- is guessable inside the 15-minute validity window (bcrypt is the only brake, and
  -- requests run concurrently).
  attempts    integer not null default 0,
  created_at  timestamptz default now()
);

alter table recruit_email_otps enable row level security;

---------------------------------------------------------------------------
-- recruit_orientation_attendance
---------------------------------------------------------------------------

create table if not exists recruit_orientation_attendance (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references recruitment_cycles(id),
  recruit_id  uuid not null references recruit_accounts(id) on delete cascade,
  scanned_at  timestamptz default now(),
  scanned_by  text,
  unique (recruit_id, cycle_id)
);

alter table recruit_orientation_attendance enable row level security;

---------------------------------------------------------------------------
-- recruit_exam_attendance
---------------------------------------------------------------------------
-- Attendance is scoped PER SUB-DOMAIN, not just per day. A recruit may apply for
-- two exam domains (e.g. coding + siesed) and sit both exams — possibly on the
-- same day. Keying on (recruit_id, cycle_id, day) alone would silently reject the
-- second scan and lose that attendance. `day` is retained as metadata recording
-- which exam day they actually sat it on.

create table if not exists recruit_exam_attendance (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references recruitment_cycles(id),
  recruit_id  uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain  recruit_subdomain not null,
  -- Nullable since migration 021: a walk-in catch-up sitting (is_walkin = true) has no
  -- day, since it isn't tied to either scheduled exam day.
  day         integer check (day is null or day in (1, 2)),
  -- Migration 021 — a recruit who already selected this domain but sat neither scheduled
  -- day gets one more chance, typically during interview day. Eligibility is unchanged
  -- (still must have selected the domain); this only records WHEN it was sat.
  is_walkin   boolean not null default false,
  scanned_at  timestamptz default now(),
  scanned_by  text,
  unique (recruit_id, cycle_id, sub_domain),
  constraint recruit_exam_attendance_walkin_day_pairing check (
    (is_walkin = true and day is null)
    or (is_walkin = false and day in (1, 2))
  )
);

alter table recruit_exam_attendance enable row level security;

-- One-time data migration (originally migration 001): the table used to be keyed
-- (recruit_id, cycle_id, day), which allowed only ONE attendance row per recruit per day
-- — scanning a recruit for their second exam on the same day hit that unique constraint
-- and silently returned "already scanned", losing the attendance record. If this table
-- already exists in that older shape (sub_domain missing or nullable), bring it up to the
-- CREATE TABLE shape above: add the column, collapse duplicates, backfill from the
-- recruit's domain selection, then enforce NOT NULL + the new unique key. No-op if the
-- column/constraint already match the shape above.
alter table recruit_exam_attendance
  add column if not exists sub_domain recruit_subdomain;

-- Pre-flight: collapse duplicate rows that would map to the same
-- (recruit_id, cycle_id, sub_domain) after backfill — e.g. a recruit scanned on both exam
-- days for a domain that only counts as one attendance record under the new model. Keep
-- the earliest scan, drop the rest.
with backfilled as (
  select ea.id, ea.recruit_id, ea.cycle_id, sel.sub_domain, ea.scanned_at,
    row_number() over (
      partition by ea.recruit_id, ea.cycle_id, sel.sub_domain
      order by ea.scanned_at asc nulls last, ea.id
    ) as rn
  from recruit_exam_attendance ea
  join (
    select distinct on (recruit_id, cycle_id) recruit_id, cycle_id, sub_domain
    from recruit_domain_selections
    where sub_domain in ('coding', 'siesed', 'corporate', 'sambed')
    order by recruit_id, cycle_id, sub_domain
  ) sel on sel.recruit_id = ea.recruit_id and sel.cycle_id = ea.cycle_id
)
delete from recruit_exam_attendance ea
using backfilled b
where ea.id = b.id and b.rn > 1;

-- Backfill: attribute any pre-existing row to the recruit's first exam-domain
-- selection, so the not-null constraint below can be applied. Rows that can't be
-- attributed (recruit has no exam-domain selection) are deleted — they were
-- meaningless under the new model anyway.
update recruit_exam_attendance ea
set sub_domain = sel.sub_domain
from (
  select distinct on (recruit_id, cycle_id) recruit_id, cycle_id, sub_domain
  from recruit_domain_selections
  where sub_domain in ('coding', 'siesed', 'corporate', 'sambed')
  order by recruit_id, cycle_id, sub_domain
) sel
where ea.recruit_id = sel.recruit_id
  and ea.cycle_id = sel.cycle_id
  and ea.sub_domain is null;

delete from recruit_exam_attendance where sub_domain is null;

alter table recruit_exam_attendance
  alter column sub_domain set not null;

alter table recruit_exam_attendance
  drop constraint if exists recruit_exam_attendance_recruit_id_cycle_id_day_key;

do $$ begin
  alter table recruit_exam_attendance
    add constraint recruit_exam_attendance_recruit_cycle_subdomain_key
    unique (recruit_id, cycle_id, sub_domain);
exception when duplicate_table or duplicate_object then null; end $$;

-- Migration 021 upgrade block, for a DB created before is_walkin existed.
alter table recruit_exam_attendance
  add column if not exists is_walkin boolean not null default false;

alter table recruit_exam_attendance
  alter column day drop not null;

do $$ begin
  alter table recruit_exam_attendance
    drop constraint if exists recruit_exam_attendance_day_check;
exception when undefined_object then null; end $$;

do $$ begin
  alter table recruit_exam_attendance
    add constraint recruit_exam_attendance_day_check
    check (day is null or day in (1, 2));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table recruit_exam_attendance
    add constraint recruit_exam_attendance_walkin_day_pairing
    check (
      (is_walkin = true and day is null)
      or (is_walkin = false and day in (1, 2))
    );
exception when duplicate_object then null; end $$;

---------------------------------------------------------------------------
-- recruit_marks
---------------------------------------------------------------------------

create table if not exists recruit_marks (
  id                 uuid primary key default gen_random_uuid(),
  cycle_id           uuid not null references recruitment_cycles(id),
  recruit_id         uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain         recruit_subdomain not null,
  -- numeric, not integer, since migration 020: half marks. Exact decimal on purpose —
  -- the shortlist engine compares marks >= cutoff and must never flip on a float
  -- representation error for someone sitting exactly on the bar.
  marks              numeric(5, 2) not null check (marks >= 0 and marks <= 100),
  evaluator_username text not null,
  -- Optional evaluator note (migration 019): the context a bare 0-100 loses — "answered
  -- only 3 of 5", "sheet partly unreadable". Never required; the marks page saves fine
  -- with it blank.
  note               text,
  entered_at         timestamptz default now(),
  updated_at         timestamptz,
  unique (recruit_id, sub_domain, cycle_id)
);

alter table recruit_marks enable row level security;

-- Migration 019 upgrade block, for a DB created before the column existed.
alter table recruit_marks add column if not exists note text;

-- Migration 020 — half marks. Widening integer -> numeric is lossless, so no backfill.
alter table recruit_marks
  alter column marks type numeric(5, 2) using marks::numeric(5, 2);

do $$ begin
  alter table recruit_marks
    add constraint recruit_marks_half_step
    check ((marks * 2) = trunc(marks * 2));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table recruit_marks
    add constraint recruit_marks_note_length
    check (note is null or char_length(note) <= 500);
exception when duplicate_object then null; end $$;

---------------------------------------------------------------------------
-- recruit_cutoffs
---------------------------------------------------------------------------

-- Gender-scoped since migration 013 and year-scoped since migration 018: a domain now has
-- FOUR cutoffs (male/female x year 1/year 2), not one.
-- shortlist/compute (src/app/api/admin/recruitment/shortlist/compute/route.ts) skips a
-- domain entirely unless ALL FOUR are set for it — see that route for why. The CREATE TABLE
-- below is the pre-013 shape; the upgrade blocks after it bring a fresh DB to current.
create table if not exists recruit_cutoffs (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references recruitment_cycles(id),
  sub_domain   recruit_subdomain not null,
  cutoff_marks numeric(5, 2) not null check (cutoff_marks >= 0 and cutoff_marks <= 100),  -- migration 020
  gender       text not null check (gender in ('male', 'female')),
  set_by       text not null,
  set_at       timestamptz default now(),
  unique (cycle_id, sub_domain, gender)
);

alter table recruit_cutoffs enable row level security;

-- Brings an already-existing recruit_cutoffs table (predating migration 013) up to the
-- gender-scoped shape. Widens every pre-existing gender-blind cutoff row into a 'male' +
-- 'female' pair carrying the same cutoff_marks forward, rather than wiping a lead's prior
-- work — see migration 013 for the full reasoning. No-op on a fresh database.
alter table recruit_cutoffs add column if not exists gender text;

alter table recruit_cutoffs drop constraint if exists recruit_cutoffs_cycle_id_sub_domain_key;

insert into recruit_cutoffs (cycle_id, sub_domain, cutoff_marks, set_by, set_at, gender)
select cycle_id, sub_domain, cutoff_marks, set_by, set_at, 'female'
from recruit_cutoffs src
where src.gender is null
  and not exists (
    select 1 from recruit_cutoffs f
    where f.cycle_id = src.cycle_id and f.sub_domain = src.sub_domain and f.gender = 'female'
  );

update recruit_cutoffs set gender = 'male' where gender is null;

alter table recruit_cutoffs alter column gender set not null;

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_gender_valid
    check (gender in ('male', 'female'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_cycle_sub_gender_key
    unique (cycle_id, sub_domain, gender);
exception when duplicate_object then null; end $$;

-- Migration 018 — year-scoped cutoffs on top of the gender scoping above. 1st and 2nd years
-- sit different papers for the same domain, so a domain now has FOUR cutoffs, not two:
-- (male, year 1), (male, year 2), (female, year 1), (female, year 2). shortlist/compute
-- skips a domain entirely unless ALL FOUR are set.
--
-- Same widening trick as 013: each existing gender row becomes year '1' in place and gets a
-- year '2' copy carrying the same cutoff_marks forward, so prior work isn't wiped. The old
-- 3-column unique key must be dropped BEFORE the backfill or the copy violates it.
alter table recruit_cutoffs add column if not exists year text;

alter table recruit_cutoffs drop constraint if exists recruit_cutoffs_cycle_sub_gender_key;

insert into recruit_cutoffs (cycle_id, sub_domain, cutoff_marks, gender, set_by, set_at, year)
select cycle_id, sub_domain, cutoff_marks, gender, set_by, set_at, '2'
from recruit_cutoffs src
where src.year is null
  and not exists (
    select 1 from recruit_cutoffs y2
    where y2.cycle_id = src.cycle_id
      and y2.sub_domain = src.sub_domain
      and y2.gender = src.gender
      and y2.year = '2'
  );

update recruit_cutoffs set year = '1' where year is null;

alter table recruit_cutoffs alter column year set not null;

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_year_valid
    check (year in ('1', '2'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_cycle_sub_gender_year_key
    unique (cycle_id, sub_domain, gender, year);
exception when duplicate_object then null; end $$;

-- Migration 020 — cutoffs move to half marks in lockstep with recruit_marks. Leaving the bar
-- an integer would make 72.5 and 72.9 indistinguishable at a cutoff of 72, so the decimals
-- would stop mattering exactly at the boundary where they matter most.
alter table recruit_cutoffs
  alter column cutoff_marks type numeric(5, 2) using cutoff_marks::numeric(5, 2);

do $$ begin
  alter table recruit_cutoffs
    add constraint recruit_cutoffs_half_step
    check ((cutoff_marks * 2) = trunc(cutoff_marks * 2));
exception when duplicate_object then null; end $$;

---------------------------------------------------------------------------
-- recruit_shortlist_status
---------------------------------------------------------------------------

create table if not exists recruit_shortlist_status (
  id               uuid primary key default gen_random_uuid(),
  cycle_id         uuid not null references recruitment_cycles(id),
  recruit_id       uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain       recruit_subdomain not null,
  status           shortlist_result not null default 'pending',
  method           text not null default 'auto',
  override_reason  text,
  overridden_by    text,
  overridden_at    timestamptz,
  computed_at      timestamptz,
  -- Phone-call confirmation (originally migration 007): a lead/admin ticks this on the
  -- Shortlist dashboard once someone has actually called the recruit. Set once, never
  -- cleared or reassigned — "called by X" is a fixed record, not a toggle.
  called_by        text,
  called_at        timestamptz,
  unique (recruit_id, sub_domain, cycle_id)
);

alter table recruit_shortlist_status enable row level security;

alter table recruit_shortlist_status add column if not exists called_by text;
alter table recruit_shortlist_status add column if not exists called_at timestamptz;

---------------------------------------------------------------------------
-- recruit_interview_panels
---------------------------------------------------------------------------

create table if not exists recruit_interview_panels (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references recruitment_cycles(id),
  domain_label text not null,
  -- Nullable on purpose: panels stay free-text-first ("Coding Panel 2", "Overflow Room"),
  -- and a lead may legitimately open a panel with no single domain. When it IS set, the
  -- panel dashboard pre-selects it for the "log result for domain" dropdown; when it is
  -- NULL the dashboard leaves that dropdown EMPTY so the interviewer must consciously
  -- pick a domain. Before this column existed, `domain_label` (free text, no link to the
  -- recruit_subdomain enum) meant the dropdown defaulted to shortlisted_for[0] — an
  -- arbitrary, unordered array element — so a recruit shortlisted for coding + vfx_gfx
  -- interviewed by the Coding panel could have their result silently written against
  -- VFX/GFX, and the later real VFX panel's upsert on (recruit_id, sub_domain, cycle_id)
  -- would then overwrite it.
  sub_domain   recruit_subdomain,
  is_active    boolean not null default true,
  created_at   timestamptz default now(),
  created_by   text not null
);

alter table recruit_interview_panels enable row level security;

---------------------------------------------------------------------------
-- recruit_interview_tokens
---------------------------------------------------------------------------

create table if not exists recruit_interview_tokens (
  id            uuid primary key default gen_random_uuid(),
  cycle_id      uuid not null references recruitment_cycles(id),
  recruit_id    uuid not null references recruit_accounts(id) on delete cascade,
  panel_id      uuid not null references recruit_interview_panels(id),
  token_number  integer not null,
  status        interview_token_status not null default 'waiting',
  checked_in_at timestamptz default now(),
  called_at     timestamptz,
  -- Set true when the check-in scan bypassed the "shortlisted for this domain" gate
  -- (originally migration 008) — a recruit who never sat the exam, or sat it and missed
  -- cutoff, but showed up on interview day and was let through as a walk-in.
  is_walkin     boolean not null default false,
  unique (recruit_id, panel_id)
);

alter table recruit_interview_tokens enable row level security;

alter table recruit_interview_tokens add column if not exists is_walkin boolean not null default false;

-- One-time data migration: token numbers are allocated read-then-insert (SELECT
-- max(token_number) then INSERT, tens of ms apart) in
-- src/app/api/admin/recruitment/scan/route.ts. Renumber any pre-existing duplicates
-- before adding the constraint below — oldest check-in keeps the original number and
-- later ones are pushed to the end of that panel's range. No-op on a fresh database.
with ranked as (
  select
    id,
    panel_id,
    row_number() over (
      partition by panel_id, token_number
      order by checked_in_at nulls last, id
    ) as dup_rank
  from recruit_interview_tokens
),
panel_max as (
  select panel_id, max(token_number) as max_number
  from recruit_interview_tokens
  group by panel_id
),
renumbered as (
  select
    r.id,
    pm.max_number + row_number() over (partition by r.panel_id order by r.id) as new_number
  from ranked r
  join panel_max pm on pm.panel_id = r.panel_id
  where r.dup_rank > 1
)
update recruit_interview_tokens t
set token_number = rn.new_number
from renumbered rn
where t.id = rn.id;

-- Why: the only pre-existing unique key was (recruit_id, panel_id), which does NOT stop
-- two volunteers scanning two different recruits into the same panel at the same moment
-- from both being handed the same token_number (see the read-then-insert race above).
--
-- !!! ACTION REQUIRED IN APPLICATION CODE !!!
-- This constraint turns a silent duplicate into a 23505 unique_violation on INSERT.
-- src/app/api/admin/recruitment/scan/route.ts (mode === "interview") must not map ANY
-- 23505 from that insert to "already_checked_in" — that would now be a lie for a
-- token_number collision. That insert needs a bounded retry loop: on 23505, first
-- re-check (recruit_id, panel_id) — if a row exists it really is a duplicate check-in;
-- otherwise it was a token_number collision, so recompute max(token_number)+1 and retry
-- (~5 attempts).
do $$ begin
  alter table recruit_interview_tokens
    add constraint recruit_interview_tokens_panel_token_key
    unique (panel_id, token_number);
exception when duplicate_table or duplicate_object then null; end $$;

-- Call Next reads (panel_id, status) ordered by token_number on every click and the
-- panel list polls token counts every 5s.
create index if not exists recruit_interview_tokens_panel_status_idx
  on recruit_interview_tokens (panel_id, status, token_number);

-- Migration 022 — a panel's running review note, independent of the final
-- Selected/Rejected/Waitlisted result (see recruit_interview_results below). Written via
-- PATCH /api/admin/recruitment/panels/tokens/:tokenId/review. One note per token - since a
-- cross-panel reassignment updates panel_id on the same row rather than inserting a new
-- one, this stays the recruit's single running note for the domain throughout the day.
alter table recruit_interview_tokens
  add column if not exists review_note text;

alter table recruit_interview_tokens
  add column if not exists review_updated_by text;

alter table recruit_interview_tokens
  add column if not exists review_updated_at timestamptz;

do $$ begin
  alter table recruit_interview_tokens
    add constraint recruit_interview_tokens_review_note_length
    check (review_note is null or char_length(review_note) <= 2000);
exception when duplicate_object then null; end $$;

-- Migration 023 — a quick rating and two optional "interested in something else" notes,
-- saved through the same PATCH route and the same review_updated_by/at pair as review_note
-- above, so a panel edits all four fields together as one review.
alter table recruit_interview_tokens
  add column if not exists rating text;

do $$ begin
  alter table recruit_interview_tokens
    add constraint recruit_interview_tokens_rating_valid
    check (rating is null or rating in ('bad', 'average', 'good'));
exception when duplicate_object then null; end $$;

alter table recruit_interview_tokens
  add column if not exists interested_other_clubs text;

alter table recruit_interview_tokens
  add column if not exists interested_other_domains text;

do $$ begin
  alter table recruit_interview_tokens
    add constraint recruit_interview_tokens_interests_length
    check (
      (interested_other_clubs is null or char_length(interested_other_clubs) <= 500)
      and (interested_other_domains is null or char_length(interested_other_domains) <= 500)
    );
exception when duplicate_object then null; end $$;

---------------------------------------------------------------------------
-- recruit_interview_results
---------------------------------------------------------------------------

create table if not exists recruit_interview_results (
  id                    uuid primary key default gen_random_uuid(),
  cycle_id              uuid not null references recruitment_cycles(id),
  recruit_id            uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain            recruit_subdomain not null,
  result                interview_result not null,
  notes                 text,
  -- Copied from recruit_interview_tokens.is_walkin when the result is first logged, so this
  -- list never needs to join back to the token table to show "not shortlisted, let in as a
  -- walk-in" (originally migration 008).
  is_walkin             boolean not null default false,
  interviewer_username  text not null,
  decided_at            timestamptz default now(),
  unique (recruit_id, sub_domain, cycle_id)
);

alter table recruit_interview_results enable row level security;

alter table recruit_interview_results add column if not exists is_walkin boolean not null default false;

-- The interview-results screen lists an entire cycle's results, and every result write
-- re-derives recruit_accounts.is_selected from (recruit_id, cycle_id).
create index if not exists recruit_interview_results_cycle_idx
  on recruit_interview_results (cycle_id);

create index if not exists recruit_interview_results_recruit_cycle_idx
  on recruit_interview_results (recruit_id, cycle_id);

---------------------------------------------------------------------------
-- recruit_training_sessions
---------------------------------------------------------------------------

-- Training runs domain by domain, and in practice a volunteer just shows up, picks their
-- domain, and starts scanning: sessions are created ON DEMAND by the first training scan
-- of the day for a domain (see the `training` case in
-- src/app/api/admin/recruitment/scan/route.ts) — a lead does not set them up in advance.
-- `sub_domain` is nullable: NULL means an all-hands session that counts for every recruit
-- (every pre-existing row before training became domain-scoped is one of these).
create table if not exists recruit_training_sessions (
  id            uuid primary key default gen_random_uuid(),
  cycle_id      uuid not null references recruitment_cycles(id),
  session_date  date not null,
  sub_domain    recruit_subdomain,
  session_label text not null,
  created_at    timestamptz default now()
);

alter table recruit_training_sessions enable row level security;

---------------------------------------------------------------------------
-- recruit_training_attendance
---------------------------------------------------------------------------
-- Declared here (immediately after recruit_training_sessions, ahead of the rest of that
-- table's constraints/indexes below) because the one-time data migration further down
-- needs both tables to already exist — it repoints recruit_training_attendance rows away
-- from duplicate recruit_training_sessions rows before the sessions table's uniqueness
-- constraint is added.

create table if not exists recruit_training_attendance (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references recruitment_cycles(id),
  recruit_id   uuid not null references recruit_accounts(id) on delete cascade,
  -- ON DELETE CASCADE: without it a training session can never be deleted while anyone
  -- is marked present for it. The admin DELETE route also removes child rows explicitly
  -- (so it works even before this was added), but the cascade is the real guarantee.
  session_id   uuid not null references recruit_training_sessions(id) on delete cascade,
  method       text not null check (method in ('qr', 'manual')),
  marked_by    text not null,
  scanned_at   timestamptz default now(),
  unique (recruit_id, session_id)
);

alter table recruit_training_attendance enable row level security;

-- Attendance is read per session (who attended this day) and per recruit (my attendance
-- across the cycle). The second is already covered by the recruit_id FK index; this
-- covers the first.
create index if not exists recruit_training_attendance_session_idx
  on recruit_training_attendance (session_id);

---------------------------------------------------------------------------
-- recruit_training_sessions — constraints/indexes (declared after
-- recruit_training_attendance exists; see note above)
---------------------------------------------------------------------------

-- One-time data migration: collapse any existing duplicate (cycle_id, session_date,
-- session_label) sessions before adding the unique constraint below. Attendance rows
-- pointing at a duplicate are re-pointed at the surviving (oldest) session; rows that
-- would collide with an existing attendance row for the survivor are dropped, since
-- (recruit_id, session_id) is already unique. No-op on a fresh database.
with ranked as (
  select
    id,
    first_value(id) over (
      partition by cycle_id, session_date, session_label
      order by created_at asc nulls last, id asc
    ) as keep_id
  from recruit_training_sessions
),
dupes as (
  select id, keep_id from ranked where id <> keep_id
)
update recruit_training_attendance a
set session_id = d.keep_id
from dupes d
where a.session_id = d.id
  and not exists (
    select 1 from recruit_training_attendance b
    where b.recruit_id = a.recruit_id and b.session_id = d.keep_id
  );

-- Anything still pointing at a duplicate session was a collision with the survivor's row
-- — the attendance fact is already recorded, drop the dupe row.
with ranked as (
  select
    id,
    row_number() over (
      partition by cycle_id, session_date, session_label
      order by created_at asc nulls last, id asc
    ) as rn
  from recruit_training_sessions
)
delete from recruit_training_attendance a
using ranked r
where a.session_id = r.id and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by cycle_id, session_date, session_label
      order by created_at asc nulls last, id asc
    ) as rn
  from recruit_training_sessions
)
delete from recruit_training_sessions s
using ranked r
where s.id = r.id and r.rn > 1;

-- Double-clicking "Create Session" used to insert a duplicate that permanently dragged
-- every attendance percentage down, with no way to delete it.
do $$ begin
  alter table recruit_training_sessions
    add constraint recruit_training_sessions_cycle_date_label_key
    unique (cycle_id, session_date, session_label);
exception when duplicate_table or duplicate_object then null; end $$;

-- Arbiter for the scan route's find-or-create upsert (ON CONFLICT (cycle_id,
-- session_date, sub_domain)). Without it, two volunteers scanning the same domain
-- simultaneously would each open a session for that day and the attendance denominator
-- would double-count it. A unique INDEX (not constraint) so it can be created
-- concurrently later if this table ever grows. NULLs are distinct (Postgres default), so
-- several all-hands sessions can still share a date, and legacy all-hands rows are
-- unaffected.
create unique index if not exists recruit_training_sessions_cycle_date_domain_key
  on recruit_training_sessions (cycle_id, session_date, sub_domain);

-- /api/recruit/me filters sessions by cycle and session_date <= today on every dashboard
-- load, and the admin training page lists a cycle's sessions newest-first.
create index if not exists recruit_training_sessions_cycle_date_idx
  on recruit_training_sessions (cycle_id, session_date desc);

-- No public SELECT/INSERT/UPDATE/DELETE policies on any table above.
-- Enable Realtime on recruit_interview_tokens via Table Editor -> Realtime toggle
-- for the live interview queue display (see 07-INTERVIEW-MODULE.md).
