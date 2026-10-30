# Project structure

| Path | Responsibility |
| --- | --- |
| `src/app` | Pages, layouts, CSS, metadata routes, HTTP route handlers |
| `src/components` | Public, admin, recruitment, Bazaar, blog, timetable, UI components |
| `src/lib` | Services, sessions, domain rules, validation, Supabase clients |
| `src/hooks`, `src/context` | Client hooks and UI state |
| `src/constants`, `src/utils` | Static content and integration helpers |
| `public` | Runtime assets, JSON fallback data, icons, service worker |
| `supabase` | SQL schema and incremental scripts; review before applying |
| `attendance` | ESP32 firmware, hardware guide, secret-free header template |
| `scripts` | Imports, seed, KB ingestion, email operations; not routine checks |
| `env-templates`, `.env.example` | Shareable configuration examples |
| `docs` | Onboarding, references, clearly marked history |
| `haloween` | Original supplied artwork; retained for provenance/reuse |
| `Recruitment-Playbook.pdf` | Recruitment reference material |
| `db.js` | Direct Postgres helper using `DATABASE_URL` |

`next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `components.json`,
`tsconfig.json`, `.npmrc`, `.nvmrc`, and the lockfile are required tooling inputs.
`vercel.json` and `.vercelignore` affect deployments. Import searches alone cannot
determine whether these files or public assets are needed.

Ignored local directories contain dependencies, builds, agent worktrees, scraped
data, and personal tooling. Ignored does not mean disposable: seven worktrees
contain unfinished edits. See the [cleanup report](cleanup-report.md).
