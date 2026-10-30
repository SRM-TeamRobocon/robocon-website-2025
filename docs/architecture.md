# Architecture

One Next.js App Router application serves public pages and operations UI. Route
handlers under [`src/app/api`](../src/app/api) are the backend; they call shared
services in `src/lib` and `src/utils`. Client components fetch these handlers;
public data paths also use the anonymous Supabase client.

| Area | Implementation |
| --- | --- |
| Public website and seasonal homepage | [`page.tsx`](../src/app/page.tsx), `src/app/{team,projects,achievements,alumni,events,gallery,blog}` |
| Layout, font, metadata | [`layout.tsx`](../src/app/layout.tsx), [`seo.ts`](../src/lib/seo.ts) |
| Dashboard/CMS | `src/app/dashboard`, [`content-resources.ts`](../src/lib/content-resources.ts), `src/components/admin` |
| Staff/member sessions | [`session.ts`](../src/lib/session.ts), [`proxy.ts`](../src/proxy.ts) |
| Recruitment | `src/app/recruit`, `src/app/dashboard/recruitment`, `src/lib/recruit-*` |
| Lab attendance | [`attendance.ts`](../src/lib/attendance.ts), `src/app/api/attendance`, [`firmware`](../attendance/main.ino) |
| Inventory requests | `src/app/dashboard/bazaar`, `src/app/api/bazaar`, `src/lib/bazaar` |
| Timetables/day order | [`timetable.ts`](../src/lib/timetable.ts), `src/components/timetable` |

Supabase Postgres/Storage hold content and operational data. Workshop registration
also uses Google Sheets/Apps Script. Google OAuth supports member and recruit
sign-in. Nodemailer sends mail; separate Gmail credentials support bulk recruitment
and attendance reminders. Web Push uses VAPID and
[`dashboard-sw.js`](../public/dashboard-sw.js).

Recruitment question answering in `src/lib/rag` uses Voyage embeddings and Groq
or Anthropic answers. PDF/image generation uses Puppeteer/Chromium and Sharp.
These existing dependencies should not be removed without tracing their consumers.
Vercel cron schedules are in [`vercel.json`](../vercel.json).

`HALLOWEEN_THEME` in `src/app/page.tsx` controls the seasonal homepage. Its photo
booth processes photos in the browser. Maintenance must preserve this behavior,
the theme, and its assets.
