-- Required profile photos for new recruitment registrations. Existing accounts are
-- deliberately left unchanged, while the registration API rejects every new request
-- without an uploaded image.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recruit-profile-photos',
  'recruit-profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table recruit_accounts
  add column if not exists profile_photo_url text;

do $$ begin
  alter table recruit_accounts
    add constraint recruit_accounts_profile_photo_url_http
    check (profile_photo_url is null or profile_photo_url ~* '^https?://');
exception when duplicate_object then null; end $$;
