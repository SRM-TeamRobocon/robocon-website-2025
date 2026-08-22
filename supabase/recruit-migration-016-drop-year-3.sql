-- Recruitment is 1st/2nd year only this cycle. The registration form never offered "3"
-- client-side, but the DB check constraint, and a few admin-side filters/validations,
-- still accepted it. Tightened everywhere to match. Safe: zero recruit_accounts rows
-- have year = '3' at the time of this migration.
alter table recruit_accounts drop constraint recruit_accounts_year_check;
alter table recruit_accounts add constraint recruit_accounts_year_check check (year in ('1', '2'));
