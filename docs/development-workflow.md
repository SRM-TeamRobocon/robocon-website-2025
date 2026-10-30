# Development workflow

Keep `main` as the primary branch. Start from an updated main and create a task
branch (`git switch -c feat/short-description`). Review `git status` first;
preserve unrelated changes and worktrees. Keep PRs focused and request review with
the concrete behavior change, validation, and any limitations.

Routine checks, after reading the affected scripts/configuration:

```sh
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

`lint` currently invokes removed `next lint` and fails before inspecting source.
The legacy `.eslintrc.json`, ESLint 8, and Next 16 config need a separate tooling
migration; do not claim lint passed or suppress rules to make a cleanup green.
Type checking and the build remain useful independent checks. Build requires
Google Fonts access and can read configured content services during prerendering.

There is no general automated test script in `package.json`. For behavior changes,
exercise the affected route/UI, invalid input, missing session, wrong role, and
authorized success. Use development accounts and data. For documentation-only
changes check links, paths, ignored secrets, and the diff.

| Script | Side effects; do not run as a routine test |
| --- | --- |
| `test:email` | Sends real email to a hardcoded recipient |
| `seed:recruitment` | Can delete active-cycle data and insert synthetic recruits with `--yes` |
| `import:alumni`, `import:gallery`, `scripts/import-blogs.ts` | Database inserts and image downloads/uploads |
| `scripts/ingest-recruit-kb.ts` | Embedding API calls and knowledge-base changes |
| `scripts/backfill-ticket-resolution-emails.ts` | Sends mail and updates delivery state |

Inspect a script and its target environment before explicit use. Database changes,
real email, deployment, and destructive operations are separate from local checks.
Update docs for changed schemas, APIs, environment requirements, and key behavior.
Do not force-push, delete remote branches, or change hosting/repository settings
as part of maintenance.
