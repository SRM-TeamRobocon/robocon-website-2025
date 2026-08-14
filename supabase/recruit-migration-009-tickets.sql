-- Migration 009 — recruit support tickets (domain change + general requests).
--
-- Safe to run more than once (every statement is guarded).
--
-- Why: recruits have no self-service way to ask a lead anything after registration.
-- This is a general-purpose ticket a recruit can raise from their dashboard — either to
-- request a domain change, or to ask/report anything else. A lead resolves it BY HAND
-- through existing admin tooling and marks it resolved here.
--
-- Domain change is deliberately NOT automated: recruit_domain_selections is a join key
-- for marks/shortlist/interview_tokens (see the comment in
-- src/app/api/admin/recruitment/recruits/[id]/route.ts), so it is never edited directly
-- from a ticket. This migration and its API routes never write to
-- recruit_domain_selections — a lead updates it manually after reading the ticket.
--
-- current_sub_domains snapshots the recruit's full domain set at request time (a recruit
-- can hold more than one). requested_sub_domain is only set for category='domain_change'.

create table if not exists recruit_tickets (
  id                     uuid primary key default gen_random_uuid(),
  cycle_id               uuid not null references recruitment_cycles(id),
  recruit_id             uuid not null references recruit_accounts(id) on delete cascade,
  category               text not null check (category in ('domain_change', 'general')),
  message                text not null,
  current_sub_domains    recruit_subdomain[],
  requested_sub_domain   recruit_subdomain,
  status                 text not null default 'open' check (status in ('open', 'resolved')),
  resolution_note        text,
  resolved_by            text,
  resolved_at            timestamptz,
  created_at             timestamptz default now()
);

-- A domain_change ticket must carry its target domain; a general ticket must not.
do $$ begin
  alter table recruit_tickets
    add constraint recruit_tickets_domain_change_shape
    check (
      (category = 'domain_change' and requested_sub_domain is not null)
      or (category = 'general' and requested_sub_domain is null)
    );
exception when duplicate_object then null; end $$;

alter table recruit_tickets enable row level security;
-- No public policies: service-role only, same pattern as recruit_domain_selections.

-- One OPEN ticket per recruit at a time (any category) — keeps the admin queue and the
-- recruit's own "raise a new ticket" UX simple: finish this one, then raise another.
-- Enforced at the DB layer (race-safe under concurrent submits), not just an app-level
-- check-then-insert.
create unique index if not exists recruit_tickets_one_open_per_recruit
  on recruit_tickets (recruit_id)
  where status = 'open';

create index if not exists recruit_tickets_cycle_status_idx
  on recruit_tickets (cycle_id, status);
