# Getting started

1. Clone `SRM-TeamRobocon/robocon-website-2025` and use Node **24.x** (`.nvmrc`).
2. Run `npm ci`. Keep the lockfile and `.npmrc` (`legacy-peer-deps=true`).
3. Copy [`.env.example`](../.env.example) to `.env.local`, without overwriting an
   existing local environment. Obtain development credentials from a maintainer.
4. Run `npm run dev` and open `http://localhost:3000`.
5. Check `/`, `/projects`, and the feature you intend to edit. Fallback public
   content is not proof that the database is connected.

PowerShell: `Copy-Item .env.example .env.local`. Use `npm.cmd` and `npx.cmd` if
execution policy blocks the PowerShell wrappers; do not weaken machine policy.

Dashboard access starts at `/login`. Staff credentials use a development
`LEAD_ACCOUNTS` JSON map. Member accounts require verification and approval.
Recruitment uses `/recruit/login`. Do not seed production to obtain a test account.

A build loads `.env.local` and may read services during prerendering. Use a
development environment. See [environment setup](environment-setup.md) and
[validation commands](development-workflow.md).
