-- Adds a "called" phone-confirmation flag to recruit_shortlist_status: a lead/admin ticks
-- a box on the Shortlist dashboard once someone from the team has actually called the
-- recruit (about their shortlist result), independent of the interview panel's queue
-- system. Locked after the first tick — called_by/called_at are only ever set once, never
-- cleared or reassigned, so "called by X" is a fixed record of who made the call.
-- Safe to re-run: guarded with IF NOT EXISTS.

alter table recruit_shortlist_status
  add column if not exists called_by text;

alter table recruit_shortlist_status
  add column if not exists called_at timestamptz;
