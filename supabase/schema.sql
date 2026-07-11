create extension if not exists pgcrypto;

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  domain text,
  year text,
  photo_url text,
  linkedin_url text,
  instagram_url text,
  facebook_url text,
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  abstract text,
  cover_image_url text,
  gallery_urls text[],
  shortkey text,
  tech_stack text[],
  year text,
  competition text,
  display_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  abstract text,
  cover_image_url text,
  gallery_urls text[],
  achievement_date date,
  competition text,
  rank text,
  display_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  abstract text,
  cover_image_url text,
  gallery_urls text[],
  event_date timestamptz,
  location text,
  registration_link text,
  is_upcoming boolean default true,
  display_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists alumni (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  designation text,
  about text,
  description text,
  profession text,
  batch text,
  photo_url text,
  linkedin_url text,
  instagram_url text,
  facebook_url text,
  display_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  title text,
  category text,
  content text,
  display_order integer default 0,
  uploaded_at timestamptz default now()
);

create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  submitted_at timestamptz default now(),
  is_read boolean default false
);

alter table members enable row level security;
alter table projects enable row level security;
alter table achievements enable row level security;
alter table events enable row level security;
alter table alumni enable row level security;
alter table gallery enable row level security;
alter table contact_submissions enable row level security;

drop policy if exists public_read_members on members;
drop policy if exists public_read_projects on projects;
drop policy if exists public_read_achievements on achievements;
drop policy if exists public_read_events on events;
drop policy if exists public_read_alumni on alumni;
drop policy if exists public_read_gallery on gallery;

create policy public_read_members on members for select using (true);
create policy public_read_projects on projects for select using (true);
create policy public_read_achievements on achievements for select using (true);
create policy public_read_events on events for select using (true);
create policy public_read_alumni on alumni for select using (true);
create policy public_read_gallery on gallery for select using (true);

insert into storage.buckets (id, name, public)
values
  ('member-photos', 'member-photos', true),
  ('gallery', 'gallery', true),
  ('event-posters', 'event-posters', true),
  ('project-covers', 'project-covers', true),
  ('achievement-images', 'achievement-images', true),
  ('media', 'media', true)
on conflict (id) do update set public = excluded.public;
