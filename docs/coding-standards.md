# Components and coding standards

Use TypeScript and the existing `@/*` alias for `src/*`. Match surrounding style.
Keep server utilities out of client imports and preserve `server-only` guards.
Use `"use client"` only for browser APIs, state, or effects.

Reuse [`Header`](../src/components/Header.tsx), [`Footer`](../src/components/Footer.tsx),
`src/components/ui` controls, and feature components. Shared upload behavior lives
in [`ContentImageFields`](../src/components/ContentImageFields.tsx); CMS forms use
[`AdminContentManager`](../src/components/admin/AdminContentManager.tsx).
[`cn`](../src/lib/utils.ts) combines classes.

Preserve the existing theme and colors. Edited UI and generated captions use
Aldrich from [`layout.tsx`](../src/app/layout.tsx) and `--font-robocon`.
Use `border-radius: 0`, no `rounded-*` classes, new fonts, or new palette.
Supplied artwork may retain its own lettering/shapes. Do not restyle unrelated
pages because legacy font configuration exists. See [Halloween design](halloween-design.md).

Place a reusable component in its existing feature directory, give props concrete
types, and compose existing controls. Keep labels, keyboard access, focus, alt
text, loading states, and errors. Introduce abstractions only for actual reuse.

Validate external input at API boundaries. Handle network/database failures and
enforce authorization server-side. Update callers and documentation with behavior
changes. Add meaningful tests for new logic, without adding a test framework just
for trivial edits.
