# Centralized Digital Storage — Implementation Plan

Status: **planning only — nothing in this doc is built yet.** This is a spec for a new dashboard module that gives leads/admins/members a single place to store, organize, and retrieve team documents, photographs, letters, and other files, backed by Google Drive.

## 1. Goal

Replace the current pattern of files scattered across personal Drives, WhatsApp, and email with one repository, reachable from the existing `/dashboard`, with:

- Upload, folders, rename, move, delete
- File search (by name/tags)
- Previews for common types (images, PDF)
- Downloads
- Role-gated access (who can see/write which folders)

This is a **new, separate subsystem** — it does not touch the CMS (`CONTENT_RESOURCES`), blogs, timetables, or recruitment modules. It plugs into the existing auth/role system only.

## 2. Where files actually live: Google Drive vs. Supabase Storage

Two viable backends exist in this codebase already. Worth deciding explicitly before writing code:

| | Google Drive | Supabase Storage |
|---|---|---|
| Already used here for | Sheets (attendance/registration) via a service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY`, [googleSheets.ts](src/utils/googleSheets.ts)) | Member photos, gallery, event posters, project covers ([admin.ts](src/lib/supabase/admin.ts)) |
| Familiar to non-technical members? | Yes — most people already think in "Drive folders" | No — just an API-backed bucket |
| Quota gotcha | **Service accounts have 0 bytes of personal Drive storage.** Files must land in a **Shared Drive** (Google Workspace) that the service account is added to as a member — otherwise every upload fails with a storage-quota error. Need to confirm SRM's `srmist.edu.in` Workspace has a Shared Drive available (or create one) and add the existing service account to it. | No quota gotcha — billed against the Supabase project's storage plan |
| Upload size limits | Drive resumable upload sessions bypass server body-size limits entirely (see §5) | Also supports large files, but still round-trips through our own API route unless using signed upload URLs |

**Decision needed before Phase 1 starts:** does SRM Robocon have (or can get) a Google Workspace Shared Drive to add the existing service account to? If not, the whole plan below still works almost unchanged with Supabase Storage buckets swapped in for the Drive calls in §5 — the metadata schema (§4) and API surface (§6) are backend-agnostic by design, specifically so this swap is cheap if Drive turns out to be blocked. Recommend confirming this first rather than discovering it mid-build.

The rest of this doc assumes **Google Drive via Shared Drive** as the chosen backend, since that's what was asked for.

## 3. Access model

Reuses the existing single-JWT/three-role system (`admin_token` cookie, `lead | admin | member` — see [session.ts](src/lib/session.ts)). No new auth mechanism.

- `admin` / `lead`: full access to all folders by default (create, rename, move, delete, manage permissions).
- `member`: read/write scoped per-folder via a permissions table (§4) — e.g. a "Domain Docs" folder visible to everyone, an "Interview Panel" folder visible to leads only, a personal "My Uploads" folder per member.
- Route protection: `/dashboard/storage/*` falls under the existing `/dashboard/*` middleware gate in [proxy.ts](src/proxy.ts) (login required); fine-grained folder permission checks happen inside the route handlers, same pattern as `/api/member/*` routes checking ownership today.

## 4. Data model (Supabase — metadata only, bytes live in Drive)

```sql
create table storage_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references storage_folders(id) on delete cascade,
  created_by uuid references member_accounts(id),
  created_at timestamptz not null default now()
);

create table storage_files (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,       -- Google Drive file ID
  name text not null,
  mime_type text,
  size_bytes bigint,
  folder_id uuid references storage_folders(id) on delete cascade,
  uploaded_by uuid references member_accounts(id),
  description text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table storage_permissions (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references storage_folders(id) on delete cascade,
  -- grant to a role, OR a specific member — one of the two is set
  role text check (role in ('member','lead','admin')),
  member_account_id uuid references member_accounts(id),
  access text not null check (access in ('read','write')) default 'read',
  created_at timestamptz not null default now()
);
```

Folder hierarchy lives **only in Supabase**, not mirrored as nested Drive folders — every file is written flat into the one Shared Drive with `drive_file_id` as the only link back. This avoids syncing two hierarchies and matches how `content_edits`/CMS tables already treat Supabase as the source of truth with an external system (Sheets) as dumb storage.

Admins/leads implicitly bypass `storage_permissions` (same as they bypass per-resource CMS checks today); the table only matters for `member` role.

## 5. Upload flow (why not a normal file-upload API route)

Vercel serverless functions cap request bodies at ~4.5MB ([vercel.json](vercel.json) is already in this repo, confirming Vercel hosting) — fine for the Sheets/CMS payloads today, not fine for PDFs/photos/videos here. So uploads should **not** proxy raw bytes through our own API:

1. Client asks `POST /api/dashboard/storage/upload-session` for a target folder + filename + mime type.
2. Server (holding the service-account credentials) opens a **Drive resumable upload session** (`uploadType=resumable`) and returns the session URL to the client. A pending `storage_files` row is *not* created yet — nothing to clean up if the client abandons the upload.
3. Client `PUT`s the file bytes **directly to Google**, in chunks, with progress events for a progress bar. Service-account credentials never reach the browser.
4. Client calls `POST /api/dashboard/storage/upload-complete` with the resulting Drive file ID; server verifies the file exists via `drive.files.get`, then inserts the `storage_files` row.

Downloads and previews go the other way — proxied *through* our server (`GET /api/dashboard/storage/files/:id/content`, calling Drive `files.get` with `alt=media` and streaming the response) rather than handing out Drive links directly. This is what makes the role/folder permission check in §3 actually enforceable — the Drive file itself stays private to the service account, never shared "anyone with the link."

## 6. API surface

All under `/api/dashboard/storage/*`, session-gated by existing middleware, role/folder-checked per-handler:

- `GET  /folders?parent=<id|null>` — list subfolders + files in a folder (permission-filtered for members)
- `POST /folders` — create folder `{ name, parent_id }`
- `PATCH /folders/:id` — rename / move
- `DELETE /folders/:id` — cascade-deletes children + their Drive files
- `POST /upload-session` — start a resumable upload (§5)
- `POST /upload-complete` — finalize metadata row (§5)
- `GET  /files/:id/content` — stream bytes for preview/download
- `PATCH /files/:id` — rename, retag, move folder
- `DELETE /files/:id` — delete from Drive + Supabase
- `GET  /search?q=` — name/tag search over `storage_files` (Postgres `ilike` or `tsvector` if this grows large)
- `POST /folders/:id/permissions` — admin/lead only, manage `storage_permissions` rows

## 7. UI (`/dashboard/storage`)

- Folder tree sidebar + breadcrumb, matching the visual language of the existing [AdminSidebar.tsx](src/components/admin/AdminSidebar.tsx) dashboard shell.
- Toolbar: new folder, upload (drag-and-drop → §5 flow with a progress bar), search box.
- File list/grid with type icons; click opens a preview modal (`<img>`/`<iframe>` pointed at the authenticated `/files/:id/content` route for images/PDFs; other types show a "download to view" state).
- Context menu per row: rename, move, download, delete, tag — visibility of each action driven by the same read/write check the API enforces (don't just hide the button, since the API is the real gate).
- Admin-only "Manage access" panel per folder to edit `storage_permissions`.

## 8. Environment variables

Reuses the existing Google service account (extend its OAuth scope to include Drive):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` — already set for Sheets; add scope `https://www.googleapis.com/auth/drive` (or the narrower `drive.file` if the service account only ever touches files it creates, which is the case here).
- `GOOGLE_DRIVE_SHARED_DRIVE_ID` — new; the Shared Drive's ID that files are uploaded into (see §2 decision).

## 9. Phased rollout

**Phase 1 — MVP**
- `storage_folders` / `storage_files` tables (schema.sql migration)
- Folder CRUD + flat file listing
- Server-proxied upload for small files only (<4MB) to get something working before building the resumable flow
- Download/preview proxy
- Admin/lead full access only (skip `storage_permissions` — everyone with dashboard access sees everything)

**Phase 2**
- Resumable direct-to-Drive upload (§5) for large files
- Search + tagging
- Image/PDF inline previews

**Phase 3**
- `storage_permissions` — per-folder role/member grants, "My Uploads" personal folders
- Audit log of who downloaded/deleted what
- Bulk actions (multi-select move/delete, zip download)

## 10. Open questions

1. **Shared Drive availability** (§2) — blocks Phase 1 upload if unresolved; Supabase Storage is the fallback backend if Drive isn't available.
2. Any file type/size restrictions needed (e.g. block executables, cap per-file size)?
3. Should member-uploaded files require lead/admin approval before becoming visible to others (same "propose → approve" pattern as [content_edits](src/app/api/admin/content-edits/route.ts) and blogs), or is direct upload fine for this use case?
