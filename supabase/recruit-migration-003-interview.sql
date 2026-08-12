-- Migration 003 — interview panels get a real sub_domain, and token numbers get a
-- unique index per panel.
--
-- Safe to run more than once (every statement is guarded).
--
-- ---------------------------------------------------------------------------
-- 1. recruit_interview_panels.sub_domain
-- ---------------------------------------------------------------------------
-- Why: `domain_label` is free text with no link to the recruit_subdomain enum, so
-- nothing tied an interview panel to the domain it was actually interviewing for.
-- The panel dashboard therefore defaulted the "log result for domain" dropdown to
-- shortlisted_for[0] — an arbitrary, unordered array element. A recruit shortlisted
-- for coding + vfx_gfx who walked into the Coding panel could have their result
-- silently written against VFX/GFX, and the later real VFX panel's upsert on
-- (recruit_id, sub_domain, cycle_id) would then OVERWRITE it.
--
-- `sub_domain` is nullable on purpose: panels stay free-text-first ("Coding Panel 2",
-- "Overflow Room"), and a lead may legitimately open a panel with no single domain.
-- When it IS set, the dashboard pre-selects it; when it is NULL the dashboard leaves
-- the result dropdown EMPTY so the interviewer must consciously pick a domain.

alter table recruit_interview_panels
  add column if not exists sub_domain recruit_subdomain;

-- ---------------------------------------------------------------------------
-- 2. unique (panel_id, token_number) on recruit_interview_tokens
-- ---------------------------------------------------------------------------
-- Why: token numbers are allocated read-then-insert (SELECT max(token_number) then
-- INSERT, tens of ms apart) in src/app/api/admin/recruitment/scan/route.ts. The only
-- existing unique key is (recruit_id, panel_id), which does NOT stop two volunteers
-- scanning two different recruits into the same panel at the same moment from both
-- being handed the same token number.
--
-- !!! ACTION REQUIRED IN APPLICATION CODE !!!
-- This constraint turns a silent duplicate into a 23505 unique_violation on INSERT.
-- src/app/api/admin/recruitment/scan/route.ts (mode === "interview") currently maps
-- ANY 23505 from that insert to "already_checked_in", which would now be a lie for a
-- token_number collision. That insert needs a bounded retry loop: on 23505, first
-- re-check (recruit_id, panel_id) — if a row exists it really is a duplicate check-in;
-- otherwise it was a token_number collision, so recompute max(token_number)+1 and
-- retry (~5 attempts). See the agent report for the exact patch.

-- Renumber any pre-existing duplicates before adding the constraint, oldest check-in
-- keeps the original number and later ones are pushed to the end of that panel's range.
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

do $$ begin
  alter table recruit_interview_tokens
    add constraint recruit_interview_tokens_panel_token_key
    unique (panel_id, token_number);
exception when duplicate_table or duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 3. Supporting indexes
-- ---------------------------------------------------------------------------
-- Call Next reads (panel_id, status) ordered by token_number on every click and the
-- panel list polls token counts every 5s.
create index if not exists recruit_interview_tokens_panel_status_idx
  on recruit_interview_tokens (panel_id, status, token_number);

-- The interview-results screen lists an entire cycle's results, and every result
-- write re-derives recruit_accounts.is_selected from (recruit_id, cycle_id).
create index if not exists recruit_interview_results_cycle_idx
  on recruit_interview_results (cycle_id);

create index if not exists recruit_interview_results_recruit_cycle_idx
  on recruit_interview_results (recruit_id, cycle_id);
