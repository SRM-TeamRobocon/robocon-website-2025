-- Migration 006 — registration number and SRM email are unique per cycle,
-- case-insensitively.
--
-- Safe to run more than once (every statement is guarded).
--
-- ---------------------------------------------------------------------------
-- Why
-- ---------------------------------------------------------------------------
-- `reg_no` had NO uniqueness of any kind, so the same student could register twice
-- (or two students could claim one registration number) with nothing stopping it.
-- `srm_email` had `unique (srm_email, cycle_id)`, but that is case-SENSITIVE.
--
-- Case matters here in practice, not just in theory: two real accounts in this table
-- were spelled `RA2531022010023` and `Ra2531022010000`. Under a plain unique
-- constraint `RA…023` and `ra…023` are different values, so the duplicate the
-- constraint exists to prevent would sail straight through.
--
-- ---------------------------------------------------------------------------
-- Why per-cycle and not global
-- ---------------------------------------------------------------------------
-- A student rejected in one intake must be able to apply again in the next one.
-- Global uniqueness would lock them out permanently. Scoping to cycle_id gives the
-- rule the team actually wants: one registration per person per intake.
--
-- ---------------------------------------------------------------------------
-- !!! ACTION REQUIRED IN APPLICATION CODE !!!
-- ---------------------------------------------------------------------------
-- These turn a silent duplicate into a 23505 unique_violation on INSERT.
-- src/app/api/recruit/auth/complete-registration/route.ts maps any insert failure to
-- a generic 500 "Could not create account.", which would be a confusing lie for a
-- recruit who simply already registered. That route now inspects the 23505 and
-- returns a 409 naming the field that collided — keep that behaviour if the insert
-- is ever rewritten.
--
-- Note this also closes a pre-existing race on email: the route's select-then-insert
-- pre-check lets two simultaneous submissions both pass the SELECT, and only the
-- database can reject the loser.

-- Expression indexes rather than plain unique constraints: they enforce the
-- case-insensitive rule at the storage layer, need no backfill of existing values,
-- and cannot be bypassed by application code that forgets to normalise.
create unique index if not exists recruit_accounts_cycle_regno_key
  on recruit_accounts (cycle_id, upper(reg_no));

create unique index if not exists recruit_accounts_cycle_email_key
  on recruit_accounts (cycle_id, lower(srm_email));

-- The original case-sensitive constraint is deliberately LEFT IN PLACE. It is
-- strictly weaker than the index above (anything it rejects, the new index also
-- rejects), so it never fires on its own, but dropping it would change the error
-- surfaced to any future ON CONFLICT (srm_email, cycle_id) upsert. Nothing upserts
-- this table today; the redundancy costs one extra index write per registration,
-- which is nothing at this volume.
