-- Migration 022 — a running review note on each interview check-in, independent of the
-- final Selected/Rejected/Waitlisted result.
--
-- Why on recruit_interview_tokens, not recruit_interview_results: results only get a row
-- once a decision is logged, but a panel should be able to jot notes on a recruit WHILE
-- they wait or are being interviewed, before any decision exists. The token row is created
-- at check-in time and persists as the recruit's stable per-domain interview record even
-- across a cross-panel reassignment (panel_id changes in place, the row is never
-- re-inserted - see recruit_allocate_interview_token / call-token), so it is always
-- available the moment someone is checked in.
--
-- One note per (recruit, domain) - last writer wins, same pattern as marks/cutoffs
-- elsewhere in this module. review_updated_by/at give the same lightweight attribution
-- those already have.
--
-- Safe to re-run.

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
