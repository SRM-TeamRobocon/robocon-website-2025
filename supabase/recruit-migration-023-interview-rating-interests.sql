-- Migration 023 — a quick rating and two optional "interested in something else" notes on
-- each interview check-in, alongside the review_note added by migration 022.
--
-- `rating` is a checked text column (same pattern as gender/travel_method elsewhere in this
-- module) rather than an enum, for the same reason: a fixed 3-value set today that might
-- grow later without an ALTER TYPE migration.
--
-- `interested_other_clubs` / `interested_other_domains` capture a panel's note that a
-- recruit expressed interest beyond the domain they're being interviewed for - free text,
-- always optional, never required to submit a review.
--
-- Same table as review_note (recruit_interview_tokens) for the same reason migration 022
-- put it there: this is per (recruit, domain) live-during-interview data, independent of
-- the final Selected/Rejected/Waitlisted result, and the token row is stable across a
-- cross-panel reassignment.
--
-- Safe to re-run.

alter table recruit_interview_tokens
  add column if not exists rating text;

do $$ begin
  alter table recruit_interview_tokens
    add constraint recruit_interview_tokens_rating_valid
    check (rating is null or rating in ('bad', 'average', 'good'));
exception when duplicate_object then null; end $$;

alter table recruit_interview_tokens
  add column if not exists interested_other_clubs text;

alter table recruit_interview_tokens
  add column if not exists interested_other_domains text;

do $$ begin
  alter table recruit_interview_tokens
    add constraint recruit_interview_tokens_interests_length
    check (
      (interested_other_clubs is null or char_length(interested_other_clubs) <= 500)
      and (interested_other_domains is null or char_length(interested_other_domains) <= 500)
    );
exception when duplicate_object then null; end $$;
