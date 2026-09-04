-- Migration 025 — persisted bulk-mail jobs for the recruitment "Send Mail" feature.
--
-- Previously a single POST handled selection -> Gmail send -> response in one blocking
-- request, with no record kept of what was sent or to whom once the response left. A
-- mid-send timeout or a transient SMTP error silently dropped some recipients with no way
-- to tell who was missed, no way to retry just the failures, and no way to later answer
-- "did recruit X get this email".
--
-- recruit_bulk_mail_jobs is the audit/progress record for one composed email; each row in
-- recruit_bulk_mail_recipients is one BCC address within that job (an address can cover
-- more than one recruit_id, since srm_email/personal_email dedupe the same way the old
-- in-memory Map did in src/app/api/admin/recruitment/send-mail/route.ts). Sending is now
-- driven as a loop of small POSTs against .../jobs/[jobId]/process, each of which sends
-- exactly one BCC-chunk and persists the result before returning - so a browser closing or
-- a request timing out mid-send leaves a resumable 'pending' tail instead of an untracked
-- gap, and a lead can come back later and hit "Retry failed" instead of re-selecting and
-- re-sending to everyone.
--
-- Safe to re-run.

create table if not exists recruit_bulk_mail_jobs (
  id             uuid primary key default gen_random_uuid(),
  cycle_id       uuid not null references recruitment_cycles(id),
  subject        text not null,
  body           text not null,
  event_at       timestamptz,
  status         text not null default 'pending',
  total_recruits integer not null default 0,
  created_by     text not null,
  created_at     timestamptz not null default now()
);

do $$ begin
  alter table recruit_bulk_mail_jobs
    add constraint recruit_bulk_mail_jobs_status_valid
    check (status in ('pending', 'sending', 'done'));
exception when duplicate_object then null; end $$;

alter table recruit_bulk_mail_jobs enable row level security;

create index if not exists recruit_bulk_mail_jobs_cycle_created_idx
  on recruit_bulk_mail_jobs (cycle_id, created_at desc);

-- One row per deduped BCC address within a job. recruit_ids is an array (rather than a
-- separate join table) because the set of recruits sharing one address is small and fixed
-- at job-creation time - never queried by recruit_id directly, only read back whole when
-- resolving a job's progress/failures (see getJobProgress in
-- src/lib/recruit-bulk-mail-jobs.ts).
create table if not exists recruit_bulk_mail_recipients (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references recruit_bulk_mail_jobs(id) on delete cascade,
  email       text not null,
  recruit_ids uuid[] not null,
  status      text not null default 'pending',
  error       text,
  attempts    integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (job_id, email)
);

do $$ begin
  alter table recruit_bulk_mail_recipients
    add constraint recruit_bulk_mail_recipients_status_valid
    check (status in ('pending', 'sent', 'failed'));
exception when duplicate_object then null; end $$;

alter table recruit_bulk_mail_recipients enable row level security;

-- The process route pulls the next pending chunk with .eq('job_id', ...).eq('status',
-- 'pending'); the job-detail route pulls the failed ones for the "failures" panel.
create index if not exists recruit_bulk_mail_recipients_job_status_idx
  on recruit_bulk_mail_recipients (job_id, status);

-- Saved subject/body presets for the composer ("Shortlist announcement", "Interview
-- reminder", ...). Global across cycles, not scoped to recruitment_cycles - the same
-- wording gets reused cycle after cycle, and there's no reason a template written last
-- cycle shouldn't be available this cycle.
create table if not exists recruit_mail_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  subject    text not null,
  body       text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table recruit_mail_templates enable row level security;

-- No public SELECT/INSERT/UPDATE/DELETE policies on any table above - admin routes read
-- and write these with the service-role client (createRecruitSupabaseAdminClient), same as
-- every other recruit_* table.
