# Repository cleanup report

Audit date: 2026-10-30. Starting commit: `c8e784f` on `main`, tracking
`origin/main`. The initial working tree contained only untracked `task.md`.
No runtime code, CSS, theme, font, colors, production assets, package versions,
lockfile, Vercel settings, database records, or live credentials were changed.

## Audit and cleanup decisions

Inspected tracked structure, graph architecture, pages/API files, package/build
configuration, proxy/session handlers, Supabase client/schema files, integration
environment names, scripts, Markdown references, assets, and Git worktrees.
The [route inventory](route-inventory.md) records 225 page/handler files. This is
a repository maintenance audit, not a claim that every API was security-tested.

Plan implemented: keep application behavior intact; move useful documentation to
docs; retain historical context under archive; remove confirmed generated artifacts;
make docs/templates trackable; preserve ambiguous files and unfinished worktrees.

| Original document | Classification and result |
| --- | --- |
| `README.md` | Essential; rewritten as onboarding entry; old operational context preserved in `docs/archive/legacy-readme.md` |
| `AGENTS.md` | Essential; added concise workflow, validation, security, and documentation rules; retained UI/discovery rules |
| `DESIGN.md` | Useful current seasonal reference; moved to `docs/halloween-design.md` |
| `PRODUCT.md` | Useful current scope; moved to `docs/halloween-product.md` |
| `ENVIRONMENT_FILES.md` | Useful local setup context; moved to `docs/environment-files.md` |
| `recruitment.md` | Useful detailed reference with dated sections; moved to `docs/recruitment.md`, labeled, links rebased |
| `digital-storage.md` | Unimplemented proposal; moved to `docs/archive/digital-storage-plan.md` |
| Annual report Markdown | Historical source material; moved to `docs/archive/annual-report-2025-26.md` |
| `attendance/README.md` | Essential hardware/operations guide; retained in place |
| `docs/SUPABASE-API-GUIDE.md` | Useful implementation walkthrough; retained |
| `.clinerules/bazaar.md` | Feature-specific agent rules; retained |
| Previously ignored `docs/bazaar/*.md` | Useful original requirements/discovery; retained, labeled historical, indexed by new README |
| Previously ignored performance plan | Historical proposal; moved to `docs/archive/edge-performance-optimization.md` |
| Ignored local `CLAUDE.md` | Stale duplicate agent instructions; replaced locally with pointers; original saved in ignored `.scratch/CLAUDE.pre-cleanup.md` |
| `task.md` | User's task input; preserved untracked |

New guides cover setup, architecture, structure, routing, components/standards,
backend/database, authentication, environments, workflow, deployment,
troubleshooting, and agent use. Closely related topics share guides rather than
empty per-topic documents. No substantive historical Markdown content was discarded.

## Deleted generated files

- `.scratch/chat-widget.png`
- `.scratch/check-home.js`
- `.scratch/home-full.png`
- `.scratch/home.html`
- `.scratch/inspect.js`
- `.scratch/main.css`
- `.scratch/recruitment-overflow-check.png`
- `halloween-mobile-frames.png`
- `halloween-two-frames.png`
- `strip-before.png`

These were browser captures, compiled CSS/HTML, or one-off inspection scripts;
they are not runtime assets. Git history retains the tracked versions. No recursive
deletion of local scratch folders was performed.

## Preserved files needing care

- All `public` assets, fallback JSON, service worker, SQL, firmware, integration
  scripts, build/deployment config, and lockfiles remain.
- `haloween` contains source artwork, including nine byte-identical pairs with
  deployed `public/halloween` files. Both sets remain: original supplied filenames
  preserve provenance; public paths are runtime contracts.
- `src/components/blog/BlogEditor.tsx.tmp.9125.85826116d22d` differs from the active
  editor (29 insertions/56 deletions in comparison). It remains tracked for owner
  review because it may contain unfinished work; the new ignore pattern does not
  untrack it. Archive or remove it only after reconciling those changes.
- `Recruitment-Playbook.pdf`, private local source data, ignored `alexa` and
  `bazaar-cline-pack`, local skills/tooling, and private environment files remain.
  Ignored personal/tool caches are outside the shareable documentation set.

## Ignore rules

Removed the blanket `docs` ignore and duplicate `.scratch` entry. Added exceptions
for `.env.example` and `*.env.example`; reviewed the root example, removed its
project-specific database hostname, and added missing integration placeholders.
Private `.env*` files remain ignored. Added test-report directories, local exports,
tmp directories, editor temp files, OS files, lint cache, and pnpm debug logs.
No active source directory was newly ignored. Previously tracked scratch files
were deleted; `.gitignore` alone would not remove them from Git.

## Branches

Deleted only these fully merged local branches after pruning their missing
worktree registrations:

- `worktree-agent-a03c00587d6af9a34`
- `worktree-agent-a78d779df643d9670`
- `worktree-agent-a978d30825b7f54cb`

Seven other `worktree-agent-*` branches are also merged but remain checked out in
worktrees with uncommitted edits: `a3ca7a9a3181d4f93`, `a561a985aa84e41ec`,
`a6ec6a4aa144a0afc`, `a9c55cbc731889545`, `ac374569970c333b0`,
`ad5f1f3d5c21772e9`, `afb9486727bfad59e`. Preserve and reconcile their edits first.

Based on the locally available remote-tracking refs, `origin/feat/workshop-banner`
and `origin/womens_day_update` are fully merged into main and are remote deletion
candidates. Confirm fresh remote state and team ownership before manual deletion.
`origin/daksh` and `origin/copilot/remove-emoji-from-whatsapp-message` are not
fully merged; preserve them. `main` and `origin/HEAD` remain. No remote branch,
GitHub setting, history, commit, or push was modified. Remote refs were not fetched.

## Validation and remaining work

- Baseline standalone TypeScript check passed (`tsc --noEmit --incremental false`).
- Baseline lint fails before checking files because `next lint` is unsupported by
  installed Next 16. The lint tooling migration remains a separate task.
- Initial build could not fetch Google Fonts in the sandbox. Network-enabled retry
  compiled successfully, then exhausted the approximately 2 GB Node heap during
  TypeScript checking. A larger-heap retry is recorded below when complete.
- No seed/import scripts, mail tests, cron endpoints, database mutations, deployment,
  or browser flows were run. No runtime/UI code changed.

Maintainer follow-up: reconcile dirty worktrees and the temporary editor snapshot;
migrate lint tooling; verify applied SQL history before onboarding a fresh database;
review existing auth secret fallbacks and reversible approval-password handling in
a separate security task. Existing fallback-image gaps mentioned in the historical
README were not repaired or claimed to be verified against live storage.
