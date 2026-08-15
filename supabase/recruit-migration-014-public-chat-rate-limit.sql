-- Migration 014 — rate limiting for the new public (unauthenticated) recruit chat.
--
-- Why: /api/recruit/public-chat (RecruitmentSection's inline "Ask a Doubt" widget) has
-- no recruit_token gate — it has to work for homepage visitors who haven't registered
-- yet — so unlike /api/recruit/chat it can't rely on session auth to bound abuse. Same
-- shape as the recruit_email_otps rate-limit check (count rows in a time window), just
-- keyed by hashed IP instead of email.

create table if not exists recruit_public_chat_requests (
  id          uuid primary key default gen_random_uuid(),
  ip_hash     text not null,
  created_at  timestamptz default now()
);

alter table recruit_public_chat_requests enable row level security;
-- No public policies: service-role only (the public-chat route runs server-side with
-- createRecruitSupabaseAdminClient() even though the route itself requires no auth).

create index if not exists recruit_public_chat_requests_ip_created_idx
  on recruit_public_chat_requests (ip_hash, created_at);
