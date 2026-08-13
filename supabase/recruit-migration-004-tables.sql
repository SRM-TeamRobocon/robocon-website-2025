-- Migration 004 — interview panels become numbered "tables" per domain, and queue
-- order becomes independently editable (drag-reorder) from the recruit's permanent
-- token number.
--
-- Safe to run more than once (every statement is guarded).

-- ---------------------------------------------------------------------------
-- 1. recruit_interview_panels.table_number
-- ---------------------------------------------------------------------------
-- Why: panels are now created by picking a domain, not typing a free-text label —
-- the app auto-generates "domain_label" as "<Domain> — Table N". table_number is
-- the machine-readable form of that N, allocated per (cycle_id, sub_domain) via the
-- same read-max-then-insert-with-retry pattern already used for token_number in
-- src/app/api/admin/recruitment/scan/route.ts. The partial unique index (sub_domain
-- IS NOT NULL) lets old panels with no sub_domain keep table_number null forever.

alter table recruit_interview_panels
  add column if not exists table_number integer;

do $$ begin
  create unique index recruit_interview_panels_domain_table_key
    on recruit_interview_panels (cycle_id, sub_domain, table_number)
    where sub_domain is not null and table_number is not null;
exception when duplicate_table or duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. recruit_interview_tokens.sub_domain (denormalized from the panel)
-- ---------------------------------------------------------------------------
-- Why: auto-routing a scanned recruit to "the least-loaded open table for domain X"
-- needs to check whether they already hold a token on ANY table for that domain, not
-- just one specific panel_id. Copying sub_domain onto the token at check-in time
-- (from the panel it's issued against) makes that a plain WHERE clause instead of a
-- join through recruit_interview_panels on every scan.

alter table recruit_interview_tokens
  add column if not exists sub_domain recruit_subdomain;

update recruit_interview_tokens t
set sub_domain = p.sub_domain
from recruit_interview_panels p
where t.panel_id = p.id and t.sub_domain is null and p.sub_domain is not null;

create index if not exists recruit_interview_tokens_recruit_subdomain_idx
  on recruit_interview_tokens (recruit_id, cycle_id, sub_domain);

-- ---------------------------------------------------------------------------
-- 3. recruit_interview_tokens.queue_position
-- ---------------------------------------------------------------------------
-- Why: "who comes next" needs to be manually reorderable (drag-and-drop) WITHOUT
-- renumbering everyone's token_number — that number is shown to the recruit on their
-- dashboard ("#12") and must stay theirs for the whole day regardless of queue
-- reshuffles. queue_position is a separate float8 so a drag can slot a token between
-- two neighbours by taking the midpoint of their positions — O(1) per reorder, no
-- cascading renumber of the rest of the queue.
--
-- Backfilled from token_number * 1000 so existing queues keep their current FIFO
-- order (the *1000 leaves room to insert new tokens between old ones if ever needed).

alter table recruit_interview_tokens
  add column if not exists queue_position double precision;

update recruit_interview_tokens
set queue_position = token_number * 1000
where queue_position is null;

create index if not exists recruit_interview_tokens_panel_position_idx
  on recruit_interview_tokens (panel_id, status, queue_position);
