# Deployment and operations

The project targets Vercel with Node 24.x and `npm run build`. Keep
[`next.config.js`](../next.config.js), [`.vercelignore`](../.vercelignore), and
[`vercel.json`](../vercel.json) intact unless deployment changes are requested.
Preview/production credentials are configured separately from local `.env.local`.
Do not infer current hosting settings from repository files; they were not changed
or inspected remotely during cleanup.

After an authorized change, validate locally, review the PR, and use the team's
existing deployment process. Check the resulting preview and build logs before
production promotion. This guide does not authorize deployment or database changes.

The committed cron schedules are UTC:

| Endpoint | UTC cron | IST |
| --- | --- | --- |
| `/api/attendance/auto-checkout` | `30 18 * * *` | 00:00 next day |
| `/api/cron/attendance-reminders` | `30 16 * * *` | 22:00 |
| `/api/cron/academia-sync` | `0 1 * * *` | 06:30 |
| `/api/cron/bazaar-reminders` | `0 4 * * *` | 09:30 |

Cron handlers require the configured `CRON_SECRET` bearer token. The secret itself
is not stored in `vercel.json`. Do not invoke cron URLs to test connectivity: they
can change records and send notifications. Check logs/configuration first.

Attendance reminders use the Gmail bulk transporter (`SMTP_EMAIL` plus
`SMTP_PASSWORD_GOOGLE`), not the general SMTP transporter. Push also needs all
three VAPID variables and browser permission. iPhone web push requires installation
to the Home Screen. Keep the firmware's device secret aligned with the server
without committing [`attendance/secrets.h`](../attendance/secrets.example.h).
