# Troubleshooting

| Symptom | Check |
| --- | --- |
| PowerShell blocks npm | Use `npm.cmd`/`npx.cmd`; do not change execution policy |
| `Invalid project directory ... /lint` | Existing `next lint` command is incompatible with Next 16; tooling migration remains open |
| Build cannot fetch Aldrich/Geist | Allow build-time access to Google Fonts; keep the existing fonts/theme |
| Public fallback content appears | Check `/api/content/<resource>`, Supabase URL/key, RLS, and response; fallback is not a successful DB connection |
| Dashboard 401/redirect | Use `/login`, same host/origin, valid JWT secret and cookie; layout canonicalizes production apex to www |
| Member login 403 | Email verification, approval, and account role; do not bypass checks |
| Recruit session fails | Separate recruit cookie/secret and cycle; staff login is not recruit login |
| Database missing table/column | Compare handler with checked-in SQL and maintainer's applied migration history; do not rerun all schemas |
| Email not sent | Correct transporter credentials; bulk Gmail differs from general SMTP |
| Push absent | All VAPID values, browser permission, installed iPhone web app |
| Type checker unexpectedly scans worktrees | Broad `tsconfig.json` includes and local files; preserve unfinished worktrees and inspect before changing scope |

Use browser Network responses and server logs together. Redact credentials, tokens,
and personal data before sharing output. Test failures caused by local network or
credentials separately from source regressions. See [cleanup report](cleanup-report.md)
for the recorded baseline.
