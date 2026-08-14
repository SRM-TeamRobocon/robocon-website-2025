-- Migration 011 — explicit "from" domain on domain-change tickets.
--
-- Safe to run more than once (every statement is guarded).
--
-- Why: recruit_tickets.current_sub_domains (migration 009) only ever snapshotted the
-- recruit's FULL domain set at request time — fine for context, but a recruit holding
-- more than one domain had no way to say WHICH one they wanted to switch out of. This
-- adds an explicit, recruit-chosen from_sub_domain alongside the existing
-- requested_sub_domain ("to"), so a domain-change ticket reads as
-- from_sub_domain -> requested_sub_domain rather than "one of these -> that one".

alter table recruit_tickets
  add column if not exists from_sub_domain recruit_subdomain;

alter table recruit_tickets drop constraint if exists recruit_tickets_domain_change_shape;

do $$ begin
  alter table recruit_tickets
    add constraint recruit_tickets_domain_change_shape
    check (
      (
        category = 'domain_change'
        and from_sub_domain is not null
        and requested_sub_domain is not null
        and from_sub_domain <> requested_sub_domain
      )
      or (
        category = 'general'
        and from_sub_domain is null
        and requested_sub_domain is null
      )
    );
exception when duplicate_object then null; end $$;
