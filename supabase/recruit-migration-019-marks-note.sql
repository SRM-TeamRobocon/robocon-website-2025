-- Migration 019 — free-text note alongside a recruit's exam marks.
--
-- Why: a bare 0-100 number loses the context an evaluator has in front of them — "answered
-- only 3 of 5", "sheet partly unreadable", "left early", "marked leniently, verify". That
-- context currently has nowhere to live, so it ends up in a WhatsApp message or nowhere at
-- all, and whoever runs shortlisting later has no way to see it.
--
-- Nullable and unconstrained apart from a length cap: this is an optional aid, never a
-- required field, and the marks page must keep saving with the note left blank. The cap is
-- enforced here as well as in the API so a direct DB write can't smuggle in a huge blob.
--
-- Safe to re-run.

alter table recruit_marks add column if not exists note text;

do $$ begin
  alter table recruit_marks
    add constraint recruit_marks_note_length
    check (note is null or char_length(note) <= 500);
exception when duplicate_object then null; end $$;
