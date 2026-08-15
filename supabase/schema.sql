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

create table if not exists faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order integer default 0,
  is_published boolean not null default true,
  created_at timestamptz default now()
);

alter table members enable row level security;
alter table projects enable row level security;
alter table achievements enable row level security;
alter table events enable row level security;
alter table alumni enable row level security;
alter table gallery enable row level security;
alter table contact_submissions enable row level security;
alter table faq enable row level security;

drop policy if exists public_read_members on members;
drop policy if exists public_read_projects on projects;
drop policy if exists public_read_achievements on achievements;
drop policy if exists public_read_events on events;
drop policy if exists public_read_alumni on alumni;
drop policy if exists public_read_gallery on gallery;
drop policy if exists public_read_faq on faq;

create policy public_read_members on members for select using (true);
create policy public_read_projects on projects for select using (true);
create policy public_read_achievements on achievements for select using (true);
create policy public_read_events on events for select using (true);
create policy public_read_alumni on alumni for select using (true);
create policy public_read_gallery on gallery for select using (true);
create policy public_read_faq on faq for select using (true);

insert into storage.buckets (id, name, public)
values
  ('member-photos', 'member-photos', true),
  ('gallery', 'gallery', true),
  ('event-posters', 'event-posters', true),
  ('project-covers', 'project-covers', true),
  ('achievement-images', 'achievement-images', true),
  ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

-- Member login: self-signup, email verification, then admin approval.
create table if not exists member_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique check (email ~* '^[^@]+@srmist\.edu\.in$'),
  domain text not null check (domain in ('SAMBED', 'SIESED', 'SPACED', 'MCSOCD')),
  reg_no text not null,
  department text not null,
  course text not null,
  phone text,
  password_hash text not null,
  email_verified boolean default false,
  verification_token text,
  verification_expires timestamptz,
  is_approved boolean default false,
  approved_at timestamptz,
  created_at timestamptz default now()
);

alter table member_accounts enable row level security;
-- No public policies: only accessed via the service-role client in API routes.

-- Optional "Sign in with Google" linking. google_uid is the stable Google account id
-- (profile.id from the userinfo endpoint); google_email is stored only for display in
-- the dashboard "Connected accounts" section and needn't match the srmist.edu.in email.
alter table member_accounts add column if not exists google_uid text unique;
alter table member_accounts add column if not exists google_email text;

-- Links an approved member account to its (initially draft) public roster row.
alter table members add column if not exists member_account_id uuid unique references member_accounts(id);

-- Member-proposed edits to public content, held for lead approval before going live.
create table if not exists content_edits (
  id uuid primary key default gen_random_uuid(),
  resource text not null check (resource in ('members', 'projects', 'achievements', 'events')),
  record_id uuid, -- null = proposing a new record; polymorphic, no FK (target table varies by resource)
  action text not null check (action in ('create', 'update')),
  payload jsonb not null,
  submitted_by uuid not null references member_accounts(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table content_edits enable row level security;
-- No public policies: service-role only, same pattern as member_accounts.

-- Self-signup accounts can be promoted to lead/admin by an existing lead/admin.
-- Env-var LEAD_ACCOUNTS accounts (role: admin) keep working in parallel (bootstrap path).
alter table member_accounts add column if not exists role text not null default 'member' check (role in ('member', 'lead', 'admin'));

-- Lets a legacy env-based lead/desk account (no member_accounts row, so no member_account_id)
-- claim an existing public roster row by their env username instead.
alter table members add column if not exists lead_username text unique;

-- Blog posts: any dashboard role (member/lead/admin) can author a draft, held for
-- lead/admin approval before it goes live. `visibility` decides where an approved
-- post shows: 'public' on the marketing site, 'private' only inside the dashboard.
-- `content` is an ordered array of blocks: {type:'heading'|'paragraph'|'image', ...}.
-- author_username stores the session identity (email or env username) so authorship
-- works even for env-based lead/admin accounts that have no member_accounts row.
create table if not exists blogs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  cover_image_url text,
  content jsonb not null default '[]'::jsonb,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references member_accounts(id),
  author_username text not null,
  author_name text not null,
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now()
);

alter table blogs enable row level security;
-- No public policies: service-role only, same pattern as content_edits. Every read
-- path filters status/visibility server-side before returning rows:
--   public site      -> src/app/blog/**            (status=approved AND visibility=public)
--   dashboard feed   -> /api/dashboard/blogs       (status=approved, both visibilities)
--   author's own     -> /api/member/blogs          (author_username = session user)
--   moderation queue -> /api/admin/blogs           (lead/admin only)

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update set public = excluded.public;

-- Member class timetables: DO1-DO5 (as labeled in the source spreadsheet) x 10 fixed
-- time slots. Self-edited, no approval step (personal schedule, not published content),
-- visible to any logged-in dashboard user. owner_username (not a members FK) mirrors
-- blogs.author_username since members/member_accounts aren't reliably 1:1.
create table if not exists timetables (
  id uuid primary key default gen_random_uuid(),
  owner_username text not null unique,
  owner_name text not null,
  domain text,
  schedule jsonb not null default '{}'::jsonb,
  -- Which campus the member's whole week is on — one value per timetable, not per slot.
  campus text not null default 'main' check (campus in ('main', 'annexure')),
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table timetables add column if not exists campus text not null default 'main';
alter table timetables drop constraint if exists timetables_campus_check;
alter table timetables add constraint timetables_campus_check check (campus in ('main', 'annexure'));

alter table timetables enable row level security;
-- No public policies: service-role only via API routes, same pattern as blogs.
