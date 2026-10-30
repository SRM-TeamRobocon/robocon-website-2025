# SRM Team Robocon Website

The team's public website and operations hub: projects, achievements, team,
alumni, events, gallery, blogs, workshops, recruitment, RFID attendance,
member dashboards, timetables, and Bazaar inventory requests.

Built with Next.js 16 App Router, React 18, TypeScript, Tailwind CSS,
Supabase Postgres/Storage, Google integrations, Nodemailer, and JWT sessions.
Preserve the existing theme, colors, and Aldrich font.

## Local setup

Requirements: Node.js **24.x** (see `.nvmrc`), npm, Git, and development
credentials from a maintainer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

PowerShell: use `Copy-Item .env.example .env.local` and `npm.cmd` if script
execution policy blocks npm. Never overwrite an existing environment.
Fill the placeholders for the features you need, then open
<http://localhost:3000>. See [getting started](docs/getting-started.md)
and [environment setup](docs/environment-setup.md).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npx tsc --noEmit` | Type check |
| `npm run lint` | Currently fails: legacy `next lint`; see troubleshooting |
| `npm run build` | Production build and type checks |
| `npm start` | Serve a completed build |

`test:email` sends real email; seed/import scripts change data. These are
not routine tests or onboarding steps.

## Contributing

Read [AGENTS.md](AGENTS.md) and the [documentation index](docs/README.md).
Keep `main` as the primary branch and work on short-lived task branches.
Submit focused PRs with behavior, validation, and limitations. Follow the
[workflow](docs/development-workflow.md) and
[coding standards](docs/coding-standards.md).

For configuration, login, lint, or Google Fonts build failures, see
[troubleshooting](docs/troubleshooting.md).
The [cleanup report](docs/cleanup-report.md) records file and branch decisions.
