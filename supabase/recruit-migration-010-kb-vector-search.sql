-- Migration 010 — recruit RAG knowledge base (vector search).
--
-- Safe to run more than once (every statement is guarded), except the vector column's
-- dimension: if this ever needs to change, drop and recreate recruit_kb_chunks (there is
-- no data worth preserving across a dimension change — it's derived from the source .txt
-- files, which stay in Storage).
--
-- Why: the recruit dashboard chatbot answers questions from admin-uploaded .txt files
-- ONLY — deliberately separate from the `faq` table (schema.sql), which is a lower-
-- friction, structured Q&A source edited through the generic content CMS. Chunks are
-- embedded with Voyage AI (voyage-3.5, 1024 dims) and retrieved by cosine distance via
-- match_recruit_kb_chunks(). Internal-only: RLS enabled, no public policies, exactly
-- like every other recruit_* administrative table (recruit_domain_selections,
-- recruit_tickets, member_accounts, content_edits).
--
-- The recruit-kb storage bucket is declared here (not supabase/schema.sql) to keep every
-- recruit-module-specific object — tables, indexes, function, bucket — in one
-- self-contained migration. storage.buckets is a single global table regardless of which
-- .sql file inserts into it, since recruit_* and the general schema share the same
-- physical Supabase project (createRecruitSupabaseAdminClient() and
-- createSupabaseAdminClient() read the identical NEXT_PUBLIC_SUPABASE_URL /
-- SUPABASE_SERVICE_ROLE_KEY).

create extension if not exists vector;

create table if not exists recruit_kb_documents (
  id            uuid primary key default gen_random_uuid(),
  filename      text not null,
  storage_path  text not null,
  uploaded_by   text not null,
  created_at    timestamptz default now()
);

alter table recruit_kb_documents enable row level security;
-- No public policies: service-role only (admin KB upload/list/delete routes + the
-- ingestion/chat routes read it), same pattern as recruit_domain_selections.

create table if not exists recruit_kb_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references recruit_kb_documents(id) on delete cascade,
  chunk_index   integer not null,
  content       text not null,
  embedding     vector(1024) not null,
  created_at    timestamptz default now()
);

alter table recruit_kb_chunks enable row level security;
-- No public policies: service-role only.

-- HNSW over ivfflat: no pre-training / list-count tuning needed, and this table stays
-- small (admin-uploaded .txt files, not a bulk corpus) — HNSW's higher build cost is a
-- non-issue at this scale and its recall is better out of the box.
create index if not exists recruit_kb_chunks_embedding_idx
  on recruit_kb_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists recruit_kb_chunks_document_id_idx
  on recruit_kb_chunks (document_id);

-- Top-K cosine-similarity search, called via supabase.rpc('match_recruit_kb_chunks', ...)
-- from the service-role client. No security definer needed: the service-role client
-- already bypasses RLS entirely, so the function's privilege model stays simplest.
create or replace function match_recruit_kb_chunks(
  query_embedding vector(1024),
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    recruit_kb_chunks.id,
    recruit_kb_chunks.document_id,
    recruit_kb_chunks.content,
    1 - (recruit_kb_chunks.embedding <=> query_embedding) as similarity
  from recruit_kb_chunks
  order by recruit_kb_chunks.embedding <=> query_embedding
  limit match_count;
$$;

insert into storage.buckets (id, name, public)
values ('recruit-kb', 'recruit-kb', false)
on conflict (id) do update set public = excluded.public;
