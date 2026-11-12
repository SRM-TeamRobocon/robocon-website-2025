# Supabase recovery and cutover

As checked on 2026-11-12, the original project `fcdaqslblhrjzioeuloe` is
reachable and is now the production Supabase project. Vercel production domains
point to deployment `dpl_8jcu4E1vBZM2XTF94xgrgkztDKLb`; its Supabase environment
variables point to the original project. The replacement project
`rfvefhdwebnebrvsedgf` is retained but is not used by the current production site.
The original project is the intended primary project. Keep the downloaded
database and Storage archives untouched. The
public-schema database export is not a verified full project backup. Storage
objects are separate from database backups.

On 2026-11-10, 189 archived images were restored to the replacement project's
public Storage buckets. The replacement database's gallery, blog (including
article content), achievement, member, and alumni image references were updated
to those objects. The pre-change row snapshot is kept outside this repository in
the sibling `robocon-backups` directory as
`image-restore-before-20261110T123839Z.json`. A further 16 member-account
profile images were uploaded and 42 profile URLs repaired in the replacement;
the corresponding pre-change snapshot is
`member-account-photos-before-20261110T133030Z.json`. Seven team members and
one alumnus have no photo in the old export, although the now-live original
database has 78 member and all 64 alumni photo URLs populated.

At the 2026-11-11 comparison, the original had 526 attendance logs and the
replacement had 707, including 180 dated since 2026-10-29. At that time the
original had 1,392 recruit accounts, 60 recruit tickets, and 3 tasks; the
replacement had none of those rows. On that date, original Storage contained
506 image objects with one-hour cache control and 55 with one-year cache
control. Cached egress, rather than database size (23 MB), caused the Free
organization restriction. Current counts and production status are below.

## Cutover checklist reference

This records the checks used for cutover; current status and remaining follow-up are listed below.

1. Verify its tables, recent records, Storage objects,
   bucket settings, and application login flows. Compare newer records in the
   replacement project before any import; merge new attendance and other writes
   by stable ID without overwriting original recruitment data.
2. Test a sample of original image URLs. The optimized Storage archive has the
   same paths as the downloaded original, but uploading it is a separate step.
   Replace only checked objects after retaining the untouched archive.
3. In a preview deployment, change the Supabase URL, public key, and server key
   together to the original project. Check any direct database connection and
   other project-specific variables as well. Never put server keys in
   `NEXT_PUBLIC_*` variables.
4. Verify public pages, member and recruit login, admin content writes,
   attendance, gallery images, and scheduled jobs before switching production.
   Plan a short write pause during the final switch to avoid records splitting
   between projects.
5. After production deployment, check errors and both cached and uncached
   egress in the Supabase organization Usage page. Keep the replacement project
   and original archives until the new primary has passed these checks.

The backups copied outside this repository are a second local copy on the same
computer. Keep an encrypted off-site copy as well; the local copy alone does
not protect against disk loss.

## Production status (2026-11-12)

- Production now serves Vercel deployment `dpl_8jcu4E1vBZM2XTF94xgrgkztDKLb`,
  built from main commit `a31372d321b620811aba97b134e1d021a70391f8`. The custom
  domains point to this deployment.
- Production Supabase environment variables and the active local `.env.local`
  point to the original project `fcdaqslblhrjzioeuloe`. The replacement project
  remains retained and is not referenced by the production site.
- The original database is reachable (PostgreSQL 17.6, database size 24 MB).
  Read-only row counts: members 82, alumni 64, member accounts 82, gallery 56,
  projects 20, achievements 18, events 9, blogs 10, attendance logs 707,
  recruit accounts 1,392, recruit tickets 60, tasks 3.
- Storage metadata totals 907 objects and 304,037,408 bytes (about 290 MiB). The
  audited member, alumni, gallery, blog cover, project, event, and achievement
  image references all matched existing objects. Public smoke checks passed for
  home, team, alumni, gallery, projects, achievements, events, and blog; rendered
  Supabase image URLs used the original project and no backup URLs were found.
- The replacement has 708 attendance logs versus 707 in the original. The
  backup-only attendance record was not copied, following the instruction to
  use only the original database. Logged-in admin and attendance-write flows
  still need a live credentialed check.
- The optimized-image migration remains incomplete: a prior run processed 80
  of 478 planned objects before direct access became unreachable. It had not
  changed database image URLs. Optimization is separate from the verified
  existing image references and is not required for the current public pages.
- Supabase health advisor returned no findings. Security advisor still reports
  RLS-enabled tables without policies, mutable function search paths, and the
  `vector` extension in `public`; review these separately before changing them.
- The encrypted Drive upload bundle remains at `../robocon-backups/Drive Backup`.
  It contains 12 hash-verified encrypted parts, a sanitized manifest, restore
  helper, and upload note; the key is stored separately. The user will upload it.
- Egress counters and billing reset date were not available through MCP. The
  last Usage screenshot supplied earlier showed 0.01/5 GB egress and 0.12/1 GB
  storage; the current object metadata total above is not a billing counter.
  No daily backup schedule is active.





