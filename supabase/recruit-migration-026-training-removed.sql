-- Migration 026 — per-domain training removal ("remove/unremove" a recruit from training).
--
-- A lead sometimes needs to pull a recruit out of training for one of their domains - a
-- no-show who stopped coming, a dropout, someone who turned out ineligible - without
-- deleting their recruit_accounts row or their existing recruit_training_attendance
-- history (which would falsify past sessions they genuinely attended). This table is a
-- separate marker rather than a soft-delete flag on recruit_accounts because removal is
-- scoped per (recruit_id, sub_domain), not per recruit: someone who applied to two domains
-- can be removed from one and stay fully active in the other.
--
-- A row present here means "this recruit is currently removed from training for this
-- sub_domain, in this cycle" - consuming routes (training-attendance overview/detail,
-- training-attendance/manual, the QR scanner's training mode) filter these recruits out of
-- normal attended/pending views and refuse new attendance marks for them. Unremoving is
-- just deleting the row (see [id]/route.ts) - there is no "removed_at" history to preserve
-- beyond the current membership, matching the frontend's "removed list at the bottom,
-- unremove moves them back" behaviour.
--
-- Safe to re-run.

create table if not exists recruit_training_removed (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references recruitment_cycles(id),
  recruit_id  uuid not null references recruit_accounts(id) on delete cascade,
  sub_domain  recruit_subdomain not null,
  removed_by  text not null,
  removed_at  timestamptz not null default now(),
  unique (recruit_id, sub_domain, cycle_id)
);

alter table recruit_training_removed enable row level security;

create index if not exists recruit_training_removed_domain_idx
  on recruit_training_removed (cycle_id, sub_domain);

-- No public policies - service-role only, same as every other recruit_* table.
