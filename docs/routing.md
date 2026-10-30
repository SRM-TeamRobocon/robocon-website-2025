# Routing

`src/app/**/page.tsx` defines pages, `layout.tsx` wraps children, and
`src/app/api/**/route.ts` exports HTTP methods. Dynamic directories such as
`[slug]`, `[event]`, and `[resource]` provide URL parameters. Existing handlers
await `params`; follow their installed-version pattern.
The [route inventory](route-inventory.md) lists actual source files.

Public pages include `/`, `/team`, `/projects`, `/achievements`, `/alumni`,
`/events`, `/gallery`, and `/blog`. Staff/member login is `/login`; operations are
under `/dashboard`. Recruits have `/recruit/login`, `/recruit/register`, and
`/recruit/dashboard`. `/recruit/tables` is public. The old README's `/admin/login`
and `/admin/dashboard/content` URLs were incorrect.

To add a page:

1. Find the closest page and reuse its layout and controls.
2. Add `src/app/<path>/page.tsx` with a default component export. For a dynamic
   page follow [`blog/[slug]/page.tsx`](../src/app/blog/[slug]/page.tsx).
3. Keep credentials server-side. Public marketing pages use
   [`seo.ts`](../src/lib/seo.ts); account pages should not opt into indexing.
4. Add navigation where needed; dashboard links live in
   [`AdminSidebar.tsx`](../src/components/admin/AdminSidebar.tsx).
5. Review [`proxy.ts`](../src/proxy.ts), enforce API permissions, and check
   anonymous, wrong-role, and authorized requests.

Not every API is protected by the proxy. See [authentication](authentication.md).
