# Route inventory

Snapshot of tracked App Router files on 2026-10-30. Dynamic segments retain their
folder names. This lists declared methods, not authorization guarantees; inspect
the linked handler and proxy. Re-exported methods are marked for inspection.

| URL | Methods/type | File |
| --- | --- | --- |
| `/achievements` | Page | [source](../src/app/achievements/page.tsx) |
| `/alumni` | Page | [source](../src/app/alumni/page.tsx) |
| `/api/admin/achievements` | GET, POST, PUT, DELETE | [source](../src/app/api/admin/achievements/route.ts) |
| `/api/admin/alumni` | GET, POST, PUT, DELETE | [source](../src/app/api/admin/alumni/route.ts) |
| `/api/admin/approval-history` | GET | [source](../src/app/api/admin/approval-history/route.ts) |
| `/api/admin/attendance/correct` | POST | [source](../src/app/api/admin/attendance/correct/route.ts) |
| `/api/admin/attendance` | PATCH | [source](../src/app/api/admin/attendance/route.ts) |
| `/api/admin/blogs` | GET, PATCH, DELETE | [source](../src/app/api/admin/blogs/route.ts) |
| `/api/admin/content-edits` | GET, PATCH | [source](../src/app/api/admin/content-edits/route.ts) |
| `/api/admin/content/[resource]` | GET, POST, PUT, DELETE | [source](../src/app/api/admin/content/[resource]/route.ts) |
| `/api/admin/content/upload` | POST | [source](../src/app/api/admin/content/upload/route.ts) |
| `/api/admin/day-order` | PATCH | [source](../src/app/api/admin/day-order/route.ts) |
| `/api/admin/events` | GET, POST, PUT, DELETE | [source](../src/app/api/admin/events/route.ts) |
| `/api/admin/gallery-albums` | GET, POST, PUT, DELETE | [source](../src/app/api/admin/gallery-albums/route.ts) |
| `/api/admin/gallery` | GET, POST, PUT, DELETE | [source](../src/app/api/admin/gallery/route.ts) |
| `/api/admin/leave-requests` | GET, PATCH | [source](../src/app/api/admin/leave-requests/route.ts) |
| `/api/admin/login` | POST | [source](../src/app/api/admin/login/route.ts) |
| `/api/admin/logout` | POST | [source](../src/app/api/admin/logout/route.ts) |
| `/api/admin/me` | GET | [source](../src/app/api/admin/me/route.ts) |
| `/api/admin/member-approvals` | GET, PATCH, DELETE | [source](../src/app/api/admin/member-approvals/route.ts) |
| `/api/admin/members` | GET, POST, PUT, DELETE | [source](../src/app/api/admin/members/route.ts) |
| `/api/admin/mentors/[id]/promote` | POST | [source](../src/app/api/admin/mentors/[id]/promote/route.ts) |
| `/api/admin/mentors` | GET, POST, PUT, DELETE | [source](../src/app/api/admin/mentors/route.ts) |
| `/api/admin/messages` | GET, PUT | [source](../src/app/api/admin/messages/route.ts) |
| `/api/admin/projects` | GET, POST, PUT, DELETE | [source](../src/app/api/admin/projects/route.ts) |
| `/api/admin/recruitment/analytics` | GET | [source](../src/app/api/admin/recruitment/analytics/route.ts) |
| `/api/admin/recruitment/attendance` | DELETE | [source](../src/app/api/admin/recruitment/attendance/route.ts) |
| `/api/admin/recruitment/cutoffs` | GET, POST | [source](../src/app/api/admin/recruitment/cutoffs/route.ts) |
| `/api/admin/recruitment/cycles/[id]/activate` | PATCH | [source](../src/app/api/admin/recruitment/cycles/[id]/activate/route.ts) |
| `/api/admin/recruitment/cycles/[id]/close` | PATCH | [source](../src/app/api/admin/recruitment/cycles/[id]/close/route.ts) |
| `/api/admin/recruitment/cycles` | GET, POST | [source](../src/app/api/admin/recruitment/cycles/route.ts) |
| `/api/admin/recruitment/exam-checkin` | GET | [source](../src/app/api/admin/recruitment/exam-checkin/route.ts) |
| `/api/admin/recruitment/interview-results/export` | GET | [source](../src/app/api/admin/recruitment/interview-results/export/route.ts) |
| `/api/admin/recruitment/interview-results/recruit-detail` | GET | [source](../src/app/api/admin/recruitment/interview-results/recruit-detail/route.ts) |
| `/api/admin/recruitment/interview-results` | GET, POST, DELETE | [source](../src/app/api/admin/recruitment/interview-results/route.ts) |
| `/api/admin/recruitment/interview-results/yet-to-be-interviewed` | GET | [source](../src/app/api/admin/recruitment/interview-results/yet-to-be-interviewed/route.ts) |
| `/api/admin/recruitment/interview-status` | GET | [source](../src/app/api/admin/recruitment/interview-status/route.ts) |
| `/api/admin/recruitment/kb/documents/[id]` | DELETE | [source](../src/app/api/admin/recruitment/kb/documents/[id]/route.ts) |
| `/api/admin/recruitment/kb/documents` | GET, POST | [source](../src/app/api/admin/recruitment/kb/documents/route.ts) |
| `/api/admin/recruitment/mail-templates/[id]` | PUT, DELETE | [source](../src/app/api/admin/recruitment/mail-templates/[id]/route.ts) |
| `/api/admin/recruitment/mail-templates` | GET, POST | [source](../src/app/api/admin/recruitment/mail-templates/route.ts) |
| `/api/admin/recruitment/marks` | GET, POST | [source](../src/app/api/admin/recruitment/marks/route.ts) |
| `/api/admin/recruitment/panels/[id]/call-next` | POST | [source](../src/app/api/admin/recruitment/panels/[id]/call-next/route.ts) |
| `/api/admin/recruitment/panels/[id]/call-token` | POST | [source](../src/app/api/admin/recruitment/panels/[id]/call-token/route.ts) |
| `/api/admin/recruitment/panels/[id]/close-for-day` | PATCH | [source](../src/app/api/admin/recruitment/panels/[id]/close-for-day/route.ts) |
| `/api/admin/recruitment/panels/[id]/close` | PATCH | [source](../src/app/api/admin/recruitment/panels/[id]/close/route.ts) |
| `/api/admin/recruitment/panels/[id]/queue` | GET | [source](../src/app/api/admin/recruitment/panels/[id]/queue/route.ts) |
| `/api/admin/recruitment/panels/[id]/reopen` | PATCH | [source](../src/app/api/admin/recruitment/panels/[id]/reopen/route.ts) |
| `/api/admin/recruitment/panels/[id]` | DELETE | [source](../src/app/api/admin/recruitment/panels/[id]/route.ts) |
| `/api/admin/recruitment/panels/[id]/tokens/[tokenId]/reorder` | PATCH | [source](../src/app/api/admin/recruitment/panels/[id]/tokens/[tokenId]/reorder/route.ts) |
| `/api/admin/recruitment/panels` | GET, POST | [source](../src/app/api/admin/recruitment/panels/route.ts) |
| `/api/admin/recruitment/panels/tokens/[tokenId]/no-show` | PATCH | [source](../src/app/api/admin/recruitment/panels/tokens/[tokenId]/no-show/route.ts) |
| `/api/admin/recruitment/panels/tokens/[tokenId]/review` | PATCH | [source](../src/app/api/admin/recruitment/panels/tokens/[tokenId]/review/route.ts) |
| `/api/admin/recruitment/panels/tokens/[tokenId]/uncall` | PATCH | [source](../src/app/api/admin/recruitment/panels/tokens/[tokenId]/uncall/route.ts) |
| `/api/admin/recruitment/panels/waiting-by-domain` | GET | [source](../src/app/api/admin/recruitment/panels/waiting-by-domain/route.ts) |
| `/api/admin/recruitment/recruits/[id]` | PATCH, DELETE | [source](../src/app/api/admin/recruitment/recruits/[id]/route.ts) |
| `/api/admin/recruitment/recruits/export` | GET | [source](../src/app/api/admin/recruitment/recruits/export/route.ts) |
| `/api/admin/recruitment/recruits` | GET | [source](../src/app/api/admin/recruitment/recruits/route.ts) |
| `/api/admin/recruitment/scan/roster` | GET | [source](../src/app/api/admin/recruitment/scan/roster/route.ts) |
| `/api/admin/recruitment/scan` | POST | [source](../src/app/api/admin/recruitment/scan/route.ts) |
| `/api/admin/recruitment/send-mail/jobs/[jobId]/process` | POST | [source](../src/app/api/admin/recruitment/send-mail/jobs/[jobId]/process/route.ts) |
| `/api/admin/recruitment/send-mail/jobs/[jobId]/retry` | POST | [source](../src/app/api/admin/recruitment/send-mail/jobs/[jobId]/retry/route.ts) |
| `/api/admin/recruitment/send-mail/jobs/[jobId]` | GET | [source](../src/app/api/admin/recruitment/send-mail/jobs/[jobId]/route.ts) |
| `/api/admin/recruitment/send-mail/jobs` | GET | [source](../src/app/api/admin/recruitment/send-mail/jobs/route.ts) |
| `/api/admin/recruitment/send-mail/preview` | POST | [source](../src/app/api/admin/recruitment/send-mail/preview/route.ts) |
| `/api/admin/recruitment/send-mail` | POST | [source](../src/app/api/admin/recruitment/send-mail/route.ts) |
| `/api/admin/recruitment/send-mail/test` | POST | [source](../src/app/api/admin/recruitment/send-mail/test/route.ts) |
| `/api/admin/recruitment/shortlist/[id]/call` | POST | [source](../src/app/api/admin/recruitment/shortlist/[id]/call/route.ts) |
| `/api/admin/recruitment/shortlist/[id]` | PATCH | [source](../src/app/api/admin/recruitment/shortlist/[id]/route.ts) |
| `/api/admin/recruitment/shortlist/compute` | POST | [source](../src/app/api/admin/recruitment/shortlist/compute/route.ts) |
| `/api/admin/recruitment/shortlist` | GET | [source](../src/app/api/admin/recruitment/shortlist/route.ts) |
| `/api/admin/recruitment/tickets/[id]/resolve` | POST | [source](../src/app/api/admin/recruitment/tickets/[id]/resolve/route.ts) |
| `/api/admin/recruitment/tickets` | GET | [source](../src/app/api/admin/recruitment/tickets/route.ts) |
| `/api/admin/recruitment/training-attendance/manual` | POST | [source](../src/app/api/admin/recruitment/training-attendance/manual/route.ts) |
| `/api/admin/recruitment/training-attendance` | GET | [source](../src/app/api/admin/recruitment/training-attendance/route.ts) |
| `/api/admin/recruitment/training-removed/[id]` | DELETE | [source](../src/app/api/admin/recruitment/training-removed/[id]/route.ts) |
| `/api/admin/recruitment/training-removed` | GET, POST | [source](../src/app/api/admin/recruitment/training-removed/route.ts) |
| `/api/admin/recruitment/training-sessions/[id]` | DELETE | [source](../src/app/api/admin/recruitment/training-sessions/[id]/route.ts) |
| `/api/admin/recruitment/training-sessions` | GET, POST | [source](../src/app/api/admin/recruitment/training-sessions/route.ts) |
| `/api/admin/recruitment/walkin-shortlist` | POST | [source](../src/app/api/admin/recruitment/walkin-shortlist/route.ts) |
| `/api/admin/registrations` | GET | [source](../src/app/api/admin/registrations/route.ts) |
| `/api/admin/scan` | POST | [source](../src/app/api/admin/scan/route.ts) |
| `/api/admin/update-attendance` | POST | [source](../src/app/api/admin/update-attendance/route.ts) |
| `/api/admin/verify` | POST | [source](../src/app/api/admin/verify/route.ts) |
| `/api/attendance/auto-checkout` | POST | [source](../src/app/api/attendance/auto-checkout/route.ts) |
| `/api/attendance` | GET | [source](../src/app/api/attendance/route.ts) |
| `/api/attendance/tap` | POST | [source](../src/app/api/attendance/tap/route.ts) |
| `/api/bazaar/categories` | GET | [source](../src/app/api/bazaar/categories/route.ts) |
| `/api/bazaar/items/[id]` | GET | [source](../src/app/api/bazaar/items/[id]/route.ts) |
| `/api/bazaar/items` | GET, POST | [source](../src/app/api/bazaar/items/route.ts) |
| `/api/bazaar/manage/activity` | GET | [source](../src/app/api/bazaar/manage/activity/route.ts) |
| `/api/bazaar/manage/categories/[id]` | PUT, DELETE | [source](../src/app/api/bazaar/manage/categories/[id]/route.ts) |
| `/api/bazaar/manage/categories` | GET, POST | [source](../src/app/api/bazaar/manage/categories/route.ts) |
| `/api/bazaar/manage/export` | GET | [source](../src/app/api/bazaar/manage/export/route.ts) |
| `/api/bazaar/manage/items/[id]` | GET, PUT, DELETE | [source](../src/app/api/bazaar/manage/items/[id]/route.ts) |
| `/api/bazaar/manage/items/[id]/stock-adjust` | POST | [source](../src/app/api/bazaar/manage/items/[id]/stock-adjust/route.ts) |
| `/api/bazaar/manage/items` | GET, POST | [source](../src/app/api/bazaar/manage/items/route.ts) |
| `/api/bazaar/manage/requests/[id]/approve` | POST | [source](../src/app/api/bazaar/manage/requests/[id]/approve/route.ts) |
| `/api/bazaar/manage/requests/[id]/cancel` | POST | [source](../src/app/api/bazaar/manage/requests/[id]/cancel/route.ts) |
| `/api/bazaar/manage/requests/[id]/issue` | POST | [source](../src/app/api/bazaar/manage/requests/[id]/issue/route.ts) |
| `/api/bazaar/manage/requests/[id]/reject` | POST | [source](../src/app/api/bazaar/manage/requests/[id]/reject/route.ts) |
| `/api/bazaar/manage/requests/[id]/return` | POST | [source](../src/app/api/bazaar/manage/requests/[id]/return/route.ts) |
| `/api/bazaar/manage/requests/[id]` | GET | [source](../src/app/api/bazaar/manage/requests/[id]/route.ts) |
| `/api/bazaar/manage/requests` | GET | [source](../src/app/api/bazaar/manage/requests/route.ts) |
| `/api/bazaar/manage/stats` | GET | [source](../src/app/api/bazaar/manage/stats/route.ts) |
| `/api/bazaar/manage/upload` | POST | [source](../src/app/api/bazaar/manage/upload/route.ts) |
| `/api/bazaar/me` | GET | [source](../src/app/api/bazaar/me/route.ts) |
| `/api/bazaar/requests/[id]/cancel` | POST | [source](../src/app/api/bazaar/requests/[id]/cancel/route.ts) |
| `/api/bazaar/requests` | GET, POST | [source](../src/app/api/bazaar/requests/route.ts) |
| `/api/contact` | POST | [source](../src/app/api/contact/route.ts) |
| `/api/content/[resource]` | GET | [source](../src/app/api/content/[resource]/route.ts) |
| `/api/cron/academia-sync` | POST | [source](../src/app/api/cron/academia-sync/route.ts) |
| `/api/cron/attendance-reminders` | POST | [source](../src/app/api/cron/attendance-reminders/route.ts) |
| `/api/cron/bazaar-reminders` | GET | [source](../src/app/api/cron/bazaar-reminders/route.ts) |
| `/api/dashboard/blogs/[slug]` | GET | [source](../src/app/api/dashboard/blogs/[slug]/route.ts) |
| `/api/dashboard/blogs` | GET | [source](../src/app/api/dashboard/blogs/route.ts) |
| `/api/dashboard/day-order` | GET | [source](../src/app/api/dashboard/day-order/route.ts) |
| `/api/dashboard/leave-requests/today` | GET | [source](../src/app/api/dashboard/leave-requests/today/route.ts) |
| `/api/dashboard/timetables/[username]` | GET | [source](../src/app/api/dashboard/timetables/[username]/route.ts) |
| `/api/dashboard/timetables` | GET | [source](../src/app/api/dashboard/timetables/route.ts) |
| `/api/dashboard/timetables/status` | GET | [source](../src/app/api/dashboard/timetables/status/route.ts) |
| `/api/member/attendance/correct` | POST | [source](../src/app/api/member/attendance/correct/route.ts) |
| `/api/member/attendance/me` | GET | [source](../src/app/api/member/attendance/me/route.ts) |
| `/api/member/attendance/overnight` | POST, DELETE | [source](../src/app/api/member/attendance/overnight/route.ts) |
| `/api/member/attendance/pair-start` | POST | [source](../src/app/api/member/attendance/pair-start/route.ts) |
| `/api/member/attendance/pair-status` | GET | [source](../src/app/api/member/attendance/pair-status/route.ts) |
| `/api/member/attendance/unlink` | POST | [source](../src/app/api/member/attendance/unlink/route.ts) |
| `/api/member/auth/google/callback` | GET | [source](../src/app/api/member/auth/google/callback/route.ts) |
| `/api/member/auth/google/connect/callback` | GET | [source](../src/app/api/member/auth/google/connect/callback/route.ts) |
| `/api/member/auth/google/connect` | GET | [source](../src/app/api/member/auth/google/connect/route.ts) |
| `/api/member/auth/google` | GET | [source](../src/app/api/member/auth/google/route.ts) |
| `/api/member/blogs` | GET, POST, PATCH, DELETE | [source](../src/app/api/member/blogs/route.ts) |
| `/api/member/content-edits` | GET, POST | [source](../src/app/api/member/content-edits/route.ts) |
| `/api/member/forgot-password` | POST | [source](../src/app/api/member/forgot-password/route.ts) |
| `/api/member/google-status` | GET | [source](../src/app/api/member/google-status/route.ts) |
| `/api/member/leave-requests` | GET, POST | [source](../src/app/api/member/leave-requests/route.ts) |
| `/api/member/notifications` | GET, POST, DELETE | [source](../src/app/api/member/notifications/route.ts) |
| `/api/member/reset-password` | POST | [source](../src/app/api/member/reset-password/route.ts) |
| `/api/member/signup/prefill` | GET | [source](../src/app/api/member/signup/prefill/route.ts) |
| `/api/member/signup/profile-photo` | POST | [source](../src/app/api/member/signup/profile-photo/route.ts) |
| `/api/member/signup` | POST | [source](../src/app/api/member/signup/route.ts) |
| `/api/member/timetable` | GET, PUT | [source](../src/app/api/member/timetable/route.ts) |
| `/api/member/verify` | POST | [source](../src/app/api/member/verify/route.ts) |
| `/api/payment/submit-manual-registration` | POST | [source](../src/app/api/payment/submit-manual-registration/route.ts) |
| `/api/profile` | GET, PATCH | [source](../src/app/api/profile/route.ts) |
| `/api/recruit/auth/complete-registration` | POST | [source](../src/app/api/recruit/auth/complete-registration/route.ts) |
| `/api/recruit/auth/google/callback` | GET | [source](../src/app/api/recruit/auth/google/callback/route.ts) |
| `/api/recruit/auth/google` | GET | [source](../src/app/api/recruit/auth/google/route.ts) |
| `/api/recruit/auth/login` | POST | [source](../src/app/api/recruit/auth/login/route.ts) |
| `/api/recruit/auth/logout` | POST | [source](../src/app/api/recruit/auth/logout/route.ts) |
| `/api/recruit/auth/send-otp` | POST | [source](../src/app/api/recruit/auth/send-otp/route.ts) |
| `/api/recruit/auth/verify-otp` | POST | [source](../src/app/api/recruit/auth/verify-otp/route.ts) |
| `/api/recruit/chat` | POST | [source](../src/app/api/recruit/chat/route.ts) |
| `/api/recruit/me` | GET | [source](../src/app/api/recruit/me/route.ts) |
| `/api/recruit/profile-photo` | POST | [source](../src/app/api/recruit/profile-photo/route.ts) |
| `/api/recruit/public-chat` | POST | [source](../src/app/api/recruit/public-chat/route.ts) |
| `/api/recruit/qr` | GET | [source](../src/app/api/recruit/qr/route.ts) |
| `/api/recruit/session-check` | GET | [source](../src/app/api/recruit/session-check/route.ts) |
| `/api/recruit/tables` | GET | [source](../src/app/api/recruit/tables/route.ts) |
| `/api/recruit/tickets` | GET, POST | [source](../src/app/api/recruit/tickets/route.ts) |
| `/api/recruit/verify-email/send-otp` | POST | [source](../src/app/api/recruit/verify-email/send-otp/route.ts) |
| `/api/recruit/verify-email/verify-otp` | POST | [source](../src/app/api/recruit/verify-email/verify-otp/route.ts) |
| `/blog/[slug]` | Page | [source](../src/app/blog/[slug]/page.tsx) |
| `/blog` | Page | [source](../src/app/blog/page.tsx) |
| `/dashboard/[event]` | Page | [source](../src/app/dashboard/[event]/page.tsx) |
| `/dashboard/approvals` | Page | [source](../src/app/dashboard/approvals/page.tsx) |
| `/dashboard/attendance/me` | Page | [source](../src/app/dashboard/attendance/me/page.tsx) |
| `/dashboard/attendance` | Page | [source](../src/app/dashboard/attendance/page.tsx) |
| `/dashboard/bazaar/manage/activity` | Page | [source](../src/app/dashboard/bazaar/manage/activity/page.tsx) |
| `/dashboard/bazaar/manage/inventory` | Page | [source](../src/app/dashboard/bazaar/manage/inventory/page.tsx) |
| `/dashboard/bazaar/manage` | Page | [source](../src/app/dashboard/bazaar/manage/page.tsx) |
| `/dashboard/bazaar/manage/requests` | Page | [source](../src/app/dashboard/bazaar/manage/requests/page.tsx) |
| `/dashboard/bazaar/my-requests` | Page | [source](../src/app/dashboard/bazaar/my-requests/page.tsx) |
| `/dashboard/bazaar` | Page | [source](../src/app/dashboard/bazaar/page.tsx) |
| `/dashboard/blogs/[slug]` | Page | [source](../src/app/dashboard/blogs/[slug]/page.tsx) |
| `/dashboard/blogs/edit/[id]` | Page | [source](../src/app/dashboard/blogs/edit/[id]/page.tsx) |
| `/dashboard/blogs/new` | Page | [source](../src/app/dashboard/blogs/new/page.tsx) |
| `/dashboard/blogs` | Page | [source](../src/app/dashboard/blogs/page.tsx) |
| `/dashboard/content/[resource]` | Page | [source](../src/app/dashboard/content/[resource]/page.tsx) |
| `/dashboard/content` | Page | [source](../src/app/dashboard/content/page.tsx) |
| `/dashboard/leave` | Page | [source](../src/app/dashboard/leave/page.tsx) |
| `/dashboard/mentors` | Page | [source](../src/app/dashboard/mentors/page.tsx) |
| `/dashboard/my-submissions` | Page | [source](../src/app/dashboard/my-submissions/page.tsx) |
| `/dashboard` | Page | [source](../src/app/dashboard/page.tsx) |
| `/dashboard/profile` | Page | [source](../src/app/dashboard/profile/page.tsx) |
| `/dashboard/propose` | Page | [source](../src/app/dashboard/propose/page.tsx) |
| `/dashboard/recruitment/analytics` | Page | [source](../src/app/dashboard/recruitment/analytics/page.tsx) |
| `/dashboard/recruitment/cutoffs` | Page | [source](../src/app/dashboard/recruitment/cutoffs/page.tsx) |
| `/dashboard/recruitment/cycles` | Page | [source](../src/app/dashboard/recruitment/cycles/page.tsx) |
| `/dashboard/recruitment/exam-checkin` | Page | [source](../src/app/dashboard/recruitment/exam-checkin/page.tsx) |
| `/dashboard/recruitment/interview/[panelId]` | Page | [source](../src/app/dashboard/recruitment/interview/[panelId]/page.tsx) |
| `/dashboard/recruitment/interview` | Page | [source](../src/app/dashboard/recruitment/interview/page.tsx) |
| `/dashboard/recruitment/knowledge-base` | Page | [source](../src/app/dashboard/recruitment/knowledge-base/page.tsx) |
| `/dashboard/recruitment/marks` | Page | [source](../src/app/dashboard/recruitment/marks/page.tsx) |
| `/dashboard/recruitment` | Page | [source](../src/app/dashboard/recruitment/page.tsx) |
| `/dashboard/recruitment/recruits` | Page | [source](../src/app/dashboard/recruitment/recruits/page.tsx) |
| `/dashboard/recruitment/send-mail` | Page | [source](../src/app/dashboard/recruitment/send-mail/page.tsx) |
| `/dashboard/recruitment/shortlist` | Page | [source](../src/app/dashboard/recruitment/shortlist/page.tsx) |
| `/dashboard/recruitment/tickets` | Page | [source](../src/app/dashboard/recruitment/tickets/page.tsx) |
| `/dashboard/recruitment/training` | Page | [source](../src/app/dashboard/recruitment/training/page.tsx) |
| `/dashboard/timetable/[username]` | Page | [source](../src/app/dashboard/timetable/[username]/page.tsx) |
| `/dashboard/timetable/me` | Page | [source](../src/app/dashboard/timetable/me/page.tsx) |
| `/dashboard/timetable` | Page | [source](../src/app/dashboard/timetable/page.tsx) |
| `/dashboard/workshops` | Page | [source](../src/app/dashboard/workshops/page.tsx) |
| `/events` | Page | [source](../src/app/events/page.tsx) |
| `/forgot-password` | Page | [source](../src/app/forgot-password/page.tsx) |
| `/gallery` | Page | [source](../src/app/gallery/page.tsx) |
| `/login` | Page | [source](../src/app/login/page.tsx) |
| `/` | Page | [source](../src/app/page.tsx) |
| `/projects` | Page | [source](../src/app/projects/page.tsx) |
| `/recruit-scanner` | Page | [source](../src/app/recruit-scanner/page.tsx) |
| `/recruit/dashboard` | Page | [source](../src/app/recruit/dashboard/page.tsx) |
| `/recruit/login` | Page | [source](../src/app/recruit/login/page.tsx) |
| `/recruit/logout` | GET | [source](../src/app/recruit/logout/route.ts) |
| `/recruit/register` | Page | [source](../src/app/recruit/register/page.tsx) |
| `/recruit/tables` | Page | [source](../src/app/recruit/tables/page.tsx) |
| `/registration` | Page | [source](../src/app/registration/page.jsx) |
| `/scanner` | Page | [source](../src/app/scanner/page.tsx) |
| `/signup` | Page | [source](../src/app/signup/page.tsx) |
| `/swb_reg` | Page | [source](../src/app/swb_reg/page.tsx) |
| `/team` | Page | [source](../src/app/team/page.tsx) |
| `/verify` | Page | [source](../src/app/verify/page.tsx) |
| `/workshopReg2/failed` | Page | [source](../src/app/workshopReg2/failed/page.tsx) |
| `/workshopReg2` | Page | [source](../src/app/workshopReg2/page.tsx) |
| `/workshopReg2/success` | Page | [source](../src/app/workshopReg2/success/page.tsx) |
