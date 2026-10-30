# Authentication and authorization

The app uses custom JWT cookies, not Supabase Auth sessions.
[`POST /api/admin/login`](../src/app/api/admin/login/route.ts) supports staff and
member passwords. `LEAD_ACCOUNTS` is a JSON username/password map that grants
**admin**, despite its name. Member bcrypt credentials come from `member_accounts`
and require email verification and approval. Roles are `lead`, `admin`, `member`.
`DESK_ACCOUNTS` is not read by this handler.

[`session.ts`](../src/lib/session.ts) signs/reads `admin_token`, exposes
`getSession()`/`requireRole()`, and rechecks approval for member-backed sessions.
Cookies are HTTP-only, SameSite Lax, and Secure in production. Google member
login/linking uses [`member-oauth.ts`](../src/lib/member-oauth.ts).

[`proxy.ts`](../src/proxy.ts) gates `/dashboard`, `/scanner`, `/recruit-scanner`,
and `/api/admin` except login. This only checks the JWT. Handlers must enforce
roles/ownership before privileged access. `/api/member/*` and `/api/bazaar/*`
have their own checks; Bazaar centralizes these in
[`bazaar/auth.ts`](../src/lib/bazaar/auth.ts). Client
[`use-require-role`](../src/hooks/use-require-role.ts) is UI behavior, not security.

Recruits use independent `recruit_token` cookies and
[`recruit-session.ts`](../src/lib/recruit-session.ts). The proxy protects
`/recruit/dashboard` and recruit APIs except `/api/recruit/auth/*`,
`/api/recruit/tables`, and `/api/recruit/public-chat`. Public exceptions still need
their handler's validation/rate limits.

Set separate strong `JWT_SECRET`, `RECRUIT_JWT_SECRET`, `QR_SECRET`, and
`PASSWORD_ENC_KEY`. Staff/proxy secret fallbacks are unsafe if production settings
are missing. The recruit session helper fails closed in production, but the proxy
still has a fallback. These pre-existing behaviors were documented, not changed.
Signup stores a reversible password copy for approval mail through
[`password-enc.ts`](../src/lib/password-enc.ts). Do not expand that use or log it;
changes to this lifecycle need focused security review.
