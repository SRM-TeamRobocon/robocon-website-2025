> Preserved planning/discovery reference. Read [README.md](README.md) for current scope and use AGENTS.md for current UI rules. Do not rerun historical setup steps automatically.

# Bazaar: Discovery & Theme Audit

Date: 2026-10-15  
Status: Complete (Phase 0)

---

## 1. Stack Versions & Dependencies

- **Next.js**: `16.2.4` (App Router). Note: `params`, `searchParams`, `cookies()`, and `headers()` are asynchronous and must be awaited.
- **React**: `18.3.1`
- **Tailwind CSS**: `3.4.14`
- **Supabase Client**: `@supabase/supabase-js` `^2.110.2`, `@supabase/ssr` `^0.12.0`
- **Zod**: `^3.24.2` (installed and active)
- **Icons**: `lucide-react` `^0.479.0`
- **Toasts**: `react-hot-toast` `^2.6.0`

---

## 2. Existing Authentication & Proposed Adapter

### Discovery
- **Session mechanism**: Single `admin_token` cookie containing a JWT (HS256 signed with `jose`).
- **Session reader**: `getSession()` in `src/lib/session.ts`.
- **User identity sources**:
  1. **Member accounts**: Self-registered users in `member_accounts`. JWT contains `memberAccountId` (UUID), `user` (email), `name`, `domain`, and `role` (`"member"` | `"lead"` | `"admin"`).
  2. **Staff accounts**: Bootstrap accounts defined in `LEAD_ACCOUNTS` env var. JWT contains `user` (username string) and `role: "admin"`. Display name is resolved via `displayNameForUsername(user)`.
- **Role decisions**:
  - The user confirmed that **`admin` and `lead` have identical permissions** in Bazaar. Both map to `lead`.
  - Normal users (`member`) can browse, submit requests, view/cancel their own requests, **and add new items to the inventory**.
  - `viewer` role is supported in the adapter type for read-only staff views if needed.

### Proposed Implementation of `src/lib/bazaar/auth.ts`
```ts
import "server-only";
import { getSession } from "@/lib/session";
import { displayNameForUsername } from "@/lib/admin-users";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BazaarRole = "lead" | "viewer" | "member";

export interface BazaarUser {
  id: string; // memberAccountId (UUID) or staff username (string)
  name: string;
  email?: string;
  regNumber?: string;
  role: BazaarRole;
  isStaffAccount: boolean;
}

export async function getCurrentUser(): Promise<BazaarUser | null> {
  const session = await getSession();
  if (!session) return null;

  const role: BazaarRole = (session.role === "admin" || session.role === "lead") ? "lead" : "member";

  if (session.memberAccountId) {
    const supabase = createSupabaseAdminClient();
    const { data: acc } = await supabase
      .from("member_accounts")
      .select("id, name, email, reg_no")
      .eq("id", session.memberAccountId)
      .maybeSingle();

    return {
      id: session.memberAccountId,
      name: acc?.name || session.name || "Member",
      email: acc?.email || session.user,
      regNumber: acc?.reg_no,
      role,
      isStaffAccount: false,
    };
  }

  return {
    id: session.user,
    name: session.name || displayNameForUsername(session.user) || "Admin",
    email: session.user.includes("@") ? session.user : undefined,
    role,
    isStaffAccount: true,
  };
}

export async function requireUser(): Promise<BazaarUser> {
  const user = await getCurrentUser();
  if (!user) {
    const error: any = new Error("Authentication required");
    error.status = 401;
    error.code = "BAZAAR_UNAUTHENTICATED";
    throw error;
  }
  return user;
}

export async function requireLead(): Promise<BazaarUser> {
  const user = await requireUser();
  if (user.role !== "lead") {
    const error: any = new Error("Lead role required");
    error.status = 403;
    error.code = "BAZAAR_FORBIDDEN";
    throw error;
  }
  return user;
}

export async function requireViewer(): Promise<BazaarUser> {
  const user = await requireUser();
  if (user.role !== "lead" && user.role !== "viewer") {
    const error: any = new Error("Staff access required");
    error.status = 403;
    error.code = "BAZAAR_FORBIDDEN";
    throw error;
  }
  return user;
}
```

---

## 3. Existing Dashboard & Nav Integration

- **Base path**: `/dashboard`
- **Layout wrapper**: `src/app/dashboard/layout.tsx` -> `DashboardLayoutClient.tsx`.
  - Max width: `max-w-7xl mx-auto p-4 md:p-8`.
  - Topbar: `AdminTopbar`.
  - Sidebar: `AdminSidebar` with mobile drawer and desktop collapse toggle.
- **Nav integration**:
  Add an item in `ADMIN_NAV_ITEMS` in `src/components/admin/AdminSidebar.tsx`:
  ```ts
  { label: BAZAAR_NAME, href: "/dashboard/bazaar", icon: Store, roles: ["lead", "admin", "member"] }
  ```
  *(We will import `Store` or `Package` from `lucide-react`)*.

---

## 4. Theme Cheat Sheet

| Category | Dashboard Pattern |
|---|---|
| **Backgrounds** | `bg-black`, `bg-neutral-900`, `bg-[#0f0f0f]` |
| **Borders** | `border border-white/10`, `border-b border-white/10`, `divide-white/10` |
| **Text colors** | `text-white` (headings/body), `text-gray-300`, `text-gray-400` (subtitles), `text-gray-500` (labels/muted) |
| **Brand color** | `#C20000` (`bg-red`, `hover:bg-red/80`, `text-red`, `border-red`) |
| **Heading style** | `<h1 className="text-2xl font-bold text-white tracking-tight">` |
| **Subtitle style** | `<p className="text-sm text-gray-400 mt-1">` |
| **Primary button** | `bg-red hover:bg-red/80 text-white font-bold px-4 py-2 text-sm transition-colors disabled:opacity-50` |
| **Secondary button**| `border border-white/20 hover:border-white/40 text-gray-300 hover:text-white px-4 py-2 text-sm font-semibold transition-colors` |
| **Danger button** | `bg-red/20 text-red hover:bg-red/30 border border-red/40 px-3 py-1.5 text-xs font-bold transition-colors` |
| **Input / Select** | `bg-neutral-900 border border-white/10 text-white px-3 py-2 text-sm focus:border-red focus:outline-none placeholder:text-gray-500 w-full` |
| **Table** | Container `border border-white/10 bg-black overflow-x-auto`. Header: `<tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">`. Rows: `<tr className="border-b border-white/5 hover:bg-white/[0.02]">` |
| **Card / Box** | `border border-white/10 bg-black p-5` or `bg-neutral-900/60 border border-white/10` |
| **Toasts** | `react-hot-toast` already configured in `DashboardLayoutClient.tsx` |
| **Icons** | `lucide-react` |

### Status Badges Palette
- **Pending**: `bg-yellow-500/10 text-yellow-400 border border-yellow-500/30`
- **Approved**: `bg-blue-500/10 text-blue-400 border border-blue-500/30`
- **Issued**: `bg-emerald-500/10 text-emerald-400 border border-emerald-500/30`
- **Overdue**: `bg-red/20 text-red border border-red/40 font-bold animate-pulse`
- **Returned**: `bg-gray-500/10 text-gray-300 border border-gray-500/30`
- **Rejected**: `bg-red/10 text-red/80 border border-red/20`
- **Cancelled**: `bg-white/5 text-gray-400 border border-white/10`

---

## 5. `src/proxy.ts` Verification

`src/proxy.ts` defines:
```ts
matcher: ['/dashboard/:path*', '/scanner/:path*', '/recruit-scanner/:path*', '/api/admin/:path*', '/recruit/dashboard/:path*', '/api/recruit/:path*']
```
- `/dashboard/bazaar/**` matches `/dashboard/:path*`, so it is already protected by the `admin_token` cookie gate and redirects unauthenticated users to `/login`.
- `/api/bazaar/**` is **not** matched by `proxy.ts`, allowing route handlers to use `requireUser()`, `requireLead()`, or `requireViewer()` to return JSON `401`/`403` errors.
- `/api/cron/bazaar-reminders` is **not** matched, allowing invocation with `Authorization: Bearer $CRON_SECRET`.
- **Verdict**: No modifications needed in `src/proxy.ts`.

---

## 6. Supabase Admin Client & Storage

- Server client: `createSupabaseAdminClient()` from `src/lib/supabase/admin.ts` using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Storage Bucket: `bazaar-items` bucket will be configured in `supabase/bazaar.sql` with public read access.
- Upload API: We will implement `POST /api/bazaar/manage/upload` to store images into `bazaar-items`.

---

## 7. Email Helper

- `getTransporter()` and `sendMailWithRetry()` from `src/lib/mailer.ts`.
- Uses `SMTP_EMAIL`, `SMTP_PASSWORD` / `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER`.
- Domain URL: `process.env.NEXT_PUBLIC_SITE_URL || 'https://srmrobocon.com'`.

---

## 8. Cron Routes

- `vercel.json` exists with existing crons (`auto-checkout`, `attendance-reminders`, `academia-sync`).
- We will add:
  ```json
  { "path": "/api/cron/bazaar-reminders", "schedule": "0 4 * * *" }
  ```
  (Runs daily at 04:00 UTC = 09:30 AM IST).

---

## 9. Conflict Resolutions & User Adjustments

1. **No artificial loan limits**: User specified no hard limits on request count (`BAZAAR_MAX_ACTIVE_REQUESTS` default set to unlimited/9999).
2. **Normal members can add inventory**: An "Add Item" flow is enabled for all logged-in members, allowing team members to register components they brought into the lab.
3. **Usage location**: Request form captures "In Lab" vs "Outside" (`usage_location` and `location_details`).
4. **Admin = Lead**: In Bazaar, `admin` and `lead` have equal full permissions.
