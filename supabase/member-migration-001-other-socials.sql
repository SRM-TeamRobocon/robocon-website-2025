-- Adds other_socials to the members table to store custom social media handles (heading and link pairs) as JSONB.
alter table members add column if not exists other_socials jsonb default '[]'::jsonb;

