-- Migration 008 — walk-in interviews.
--
-- The interview check-in scan used to hard-block anyone not shortlisted for the domain
-- (see the "interview" case in src/app/api/admin/recruitment/scan/route.ts). Some recruits
-- never sat the exam for a domain (or sat it and missed the cutoff) but still show up on
-- interview day wanting a shot — a volunteer/lead can now force the check-in through, and
-- `is_walkin` records that it happened so the panel and the results list can flag it rather
-- than silently treating a walk-in like a normal shortlisted candidate. Denormalized onto
-- both recruit_interview_tokens (set at check-in time) and recruit_interview_results
-- (copied from the token when a result is first logged, same pattern as sub_domain
-- elsewhere in this module) so the results list never needs to join back to the token
-- table.
--
-- Safe to re-run: guarded with IF NOT EXISTS.

alter table recruit_interview_tokens
  add column if not exists is_walkin boolean not null default false;

alter table recruit_interview_results
  add column if not exists is_walkin boolean not null default false;
