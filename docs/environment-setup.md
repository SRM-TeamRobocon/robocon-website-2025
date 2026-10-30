# Environment setup

Copy [`.env.example`](../.env.example) to `.env.local` and obtain credentials issued
for development. Never paste real keys into docs, code, chat transcripts, or commits.
`NEXT_PUBLIC_*` values reach the browser; all privileged keys remain server-only.
Restart the dev server after changing environment values.

| Feature | Variables |
| --- | --- |
| Supabase app access | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Direct SQL scripts | `DATABASE_URL` (percent-encode password characters) |
| Staff/member sessions | `JWT_SECRET`, `LEAD_ACCOUNTS` (JSON map), `PASSWORD_ENC_KEY` |
| Recruit sessions/QR | `RECRUIT_JWT_SECRET`, `QR_SECRET` |
| Canonical links/OAuth | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Transactional mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_EMAIL`, `ORGANIZER_EMAIL` |
| Gmail bulk/reminder mail | `SMTP_EMAIL`, `SMTP_PASSWORD_GOOGLE` |
| Workshop Sheets | `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_WEBHOOK_URL`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` |
| RFID/cron | `ATTENDANCE_DEVICE_SECRET`, `CRON_SECRET` |
| Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Academia sync | `ACADEMIA_API_URL`, `ACADEMIA_BOT_USERNAME`, `ACADEMIA_BOT_PASSWORD` |
| Bazaar | `BAZAAR_LEAD_EMAILS`, `BAZAAR_MAX_ACTIVE_REQUESTS`, `BAZAAR_MAX_LOAN_DAYS` |
| Optional recruitment AI | `RAG_LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `VOYAGE_API_KEY`, `GROQ1` through `GROQ10`, `GROQ_MODEL` |

Groq also accepts legacy `GROQ_API_KEYS`; see [`groq-client.ts`](../src/lib/rag/groq-client.ts).
Anthropic's SDK reads its API key. Configure only the provider used for the task.
The recruitment-only [checklist](../env-templates/recruitment.env.example) is retained;
its `RECRUIT_OTP_FROM_EMAIL` entry is legacy and not read by current source.

Google OAuth redirect URIs must match the configured development origin and the
actual callbacks under `src/app/api/member/auth/google` and
`src/app/api/recruit/auth/google`. Use development OAuth credentials; do not change
the production OAuth client while onboarding.

`.env.recruitment.local`, `.env.attendance.local`, and other grouped copies are
reference files, not automatically loaded Next.js environments. See
[environment files](environment-files.md). Deployment variables are separate.
Never run a command that prints private environment contents during an audit.
