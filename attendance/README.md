# RFID Attendance — How It Works

This is the office attendance system: an ESP32 + RFID scanner by the lab door that
tracks who's physically in, backed by Supabase (not Google Sheets — see the note at
the bottom on what this replaced).

## The short version

```
  ┌──────────────┐   tap    ┌──────────────────────┐   query/insert   ┌────────────┐
  │  RFID card    │ ───────▶│  ESP32 (main.ino)     │ ───────────────▶│  Supabase   │
  │  (member's)   │         │  POST /api/attendance  │  via Next.js    │  Postgres   │
  └──────────────┘          │  /tap                  │  API route      └────────────┘
                             └──────────────────────┘
                                       │
                                       ▼ realtime broadcast
                             ┌──────────────────────┐
                             │  /dashboard/attendance │  ← live board, any teammate
                             └──────────────────────┘
```

One physical action (a tap) triggers one HTTP request, which is the *only* place the
"what does this tap mean" logic lives. The ESP32 doesn't know anyone's name, domain,
or IN/OUT status — it just reads a UID off a card and asks the server what to do.

## Data model

Three things live in Supabase, on top of the existing `member_accounts` / `members`
tables:

- **`member_accounts.rfid_uid`** — one column, added to the existing accounts table.
  Whichever card UID is bound to your account. Unique, nullable (not everyone has
  paired a card yet).
- **`attendance_logs`** — one row per tap (or per manual correction, or per
  auto-checkout sweep). Just `member_account_id`, `action` (`IN`/`OUT`), `source`
  (`rfid` / `manual_correction` / `auto_checkout`), `device_id`, `occurred_at`.
  *Domain and name are never stored here* — they're looked up live from
  `member_accounts` → `members` whenever needed, so a rename or domain change
  instantly applies to history too, and nothing can silently drift out of sync
  (which is exactly what happened to the old hardcoded firmware roster).
- **`rfid_pairing_requests`** — short-lived rows (60s TTL) created when someone clicks
  "Link my RFID card" on the dashboard. Whichever *unrecognized* card gets tapped
  anywhere while one of these is pending gets bound to that person's account.

## The tap flow, step by step

1. Card touches the reader. `main.ino` reads the UID (`rfid.uid.uidByte[]`), formats
   it as an uppercase hex string.
2. It `POST`s that UID (plus a device ID) to `/api/attendance/tap`
   ([route.ts](../src/app/api/attendance/tap/route.ts)), with a bearer-token secret
   in the `Authorization` header so randoms on the internet can't fake taps.
3. The server looks up `member_accounts` by `rfid_uid`:
   - **Recognized** → look at that person's most recent `attendance_logs` row, flip
     `IN`↔`OUT`, insert the new row, look up their display name/domain from `members`,
     broadcast the event live (see below), and reply with `{ ok, event: "tap", action,
     name, domain }`.
   - **Not recognized, but someone has an active pairing request** → bind this UID to
     that account instead of logging a tap, mark the pairing request `claimed`, reply
     `{ ok, event: "linked", name }`.
   - **Not recognized, no pairing active** → reply `{ ok: false, event: "unauthorized"
     }`.
4. `main.ino` parses that tiny JSON reply (see below) and shows the result on the LCD.

There's also a 3-second server-side debounce: if the same card's latest log is
younger than that, the server just replies with what it already recorded instead of
double-logging — protects against a card lingering too close to the reader for two
scan cycles.

## Linking a card (self-service pairing)

No admin ever touches a UID by hand. From `/dashboard/attendance/me`, a member clicks
"Link my RFID card", which:

1. `POST /api/member/attendance/pair-start` creates a `rfid_pairing_requests` row
   with a 60-second expiry, tied to their logged-in account.
2. The dashboard polls `GET /api/member/attendance/pair-status` every 2 seconds.
3. They tap their (unrecognized) card on any scanner within that window → the tap
   route above binds it, marks the request `claimed`.
4. The dashboard sees `claimed` on its next poll and shows success.

If the window expires with no tap, the request just goes stale (`status` stays
`pending` past its `expires_at`, treated as `expired` on read) — nothing to clean up
by hand.

## Forgot to tap? Self-correction

Also on `/dashboard/attendance/me`: if your latest log is an `IN` older than an hour,
the page nudges you to fix it. You pick a time, `POST /api/member/attendance/correct`
inserts a `source: 'manual_correction'` row (with sanity checks: not in the future,
within the last 24h, doesn't overlap your existing open/closed session). No approval
step — it's your own attendance, on the honor system.

There's also a nightly cron (`POST /api/attendance/auto-checkout`, guarded by
`CRON_SECRET`) that force-closes anyone still `IN` at day's end, so nobody's "session"
silently runs for days if they forget to tap out and never notice.

## Live updates

`attendance_logs` has no public read policy (service-role only), so the dashboard
board can't just subscribe to table changes. Instead, the tap route explicitly
broadcasts a small message (`{ event, name, domain, action }`) over **Supabase
Realtime Broadcast** right after writing — a plain POST to Supabase's REST broadcast
endpoint, not a websocket, since a serverless function can't hold a connection open
between requests. `/dashboard/attendance` subscribes to that broadcast channel and
shows a toast + updates the live panel instantly. A 30-second background re-fetch is
the safety net in case a broadcast ever gets dropped.

## Firmware code walkthrough (`main.ino`)

- **WiFi + LCD + RFID init** (`setup()`) — connects to WiFi, initializes the LCD and
  the MFRC522 reader, then sits on an idle screen.
- **`extractJsonString` / `extractJsonBool`** — the server's replies are always a
  small, fixed shape (`{"ok":true,"event":"tap","action":"IN","name":"...",
  "domain":"..."}`), so instead of pulling in the ArduinoJson library, these just do
  string search for `"key":"value"` / `"key":true`. Fine because we control both ends
  of this API — don't reuse this against an API we don't control.
- **`showMessage(line1, line2)`** — writes to the 16×2 LCD, hard-truncating each line
  to 16 characters so nothing ever wraps or corrupts the display.
- **`sendTap(uid, httpCode)`** — does the actual `HTTPClient` POST. Returns the empty
  string on any non-200, and writes the numeric status into `httpCode` by reference so
  the caller can tell "never reached the server" (negative — a `HTTPClient` internal
  error code like connection-refused) from "server responded but said no" (a real
  HTTP status). `setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS)` is there because
  `tapURL` should already be the canonical host, but if it's ever pointed at a
  redirecting URL again this keeps POST requests intact through a 307/308 instead of
  silently failing.
- **`loop()`** — waits for a card, debounces repeated reads of the same UID within 3
  seconds, calls `sendTap`, and picks an LCD message based on the response. The
  "linked" branch runs a tiny multi-frame animation (see below) before landing on the
  final message.

## LCD message reference

Every message is two lines, each hard-capped at 16 characters. What each state shows:

| Situation | Line 1 | Line 2 |
|---|---|---|
| Booting | `Linking Up...` → `Locked & Loaded` | — |
| Idle | `Tap In Bestie` | `SRM Robocon` |
| Mid-request | `Checking Vibes` | `hold up...` |
| Never reached server | `No Signal Fam` | HTTP client error code (negative) |
| Server responded, not 200 | `Server Yikes` | HTTP status code |
| Unrecognized card, no pairing open | `Not On The List` | `Sry Bestie` |
| Any other server-side rejection | `Big Yikes` | the `event` string (for debugging) |
| **Card linked** | animates `<name> is...` / `syncing.` → `..` → `...` for ~0.9s | then lands on `<name> is` / `ONLINE` |
| Checked in | `<name>` | `<domain> Locked In` |
| Checked out | `<name>` | `<domain> Ghosted` |

The error-state lines keep their raw codes on screen on purpose (not just flavor
text) — that's the first thing you want to read off the LCD when a scanner is
misbehaving in the field.

## Secrets

This repo is public, so WiFi credentials and the device bearer secret live in
`attendance/secrets.h` — gitignored, never committed. `main.ino` does
`#include "secrets.h"` and references `WIFI_SSID`, `WIFI_PASSWORD`, `DEVICE_SECRET`
from it. `attendance/secrets.example.h` is the committed template — copy it to
`secrets.h` and fill in real values before flashing.

If a real secret ever ends up committed anyway (it happened once — an earlier
version of this file had both baked in directly), the fix is to **rotate it**, not to
scrub git history: generate a new value (`openssl rand -hex 32` for the device
secret), put it in `secrets.h`, and update the matching env var on the server. Once
rotated, the leaked old value is worthless — rewriting public git history to remove
it is disruptive (breaks other clones/forks) and doesn't reliably work anyway once
something's been pushed publicly.

## Environment variables this depends on

- `ATTENDANCE_DEVICE_SECRET` — set on the server (Vercel), must match `deviceSecret`
  in `main.ino`. Falls back to `"local-dev"` if unset — only acceptable for local
  testing, never in production.
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — already required by the
  rest of the app, reused here for both the DB queries and the Realtime broadcast.
- `CRON_SECRET` — guards the nightly auto-checkout sweep (shared with the rest of the
  app's cron-triggered routes).

## Flashing checklist

1. Copy `attendance/secrets.example.h` to `attendance/secrets.h` and fill in the real
   WiFi credentials and `DEVICE_SECRET` (must match `ATTENDANCE_DEVICE_SECRET` on the
   server). In `main.ino`, confirm `tapURL` points at the deployed site's canonical
   host (watch out for `www` vs non-`www` redirects — POST doesn't survive a redirect
   the `HTTPClient` library doesn't know to follow).
2. Flash it, open the Serial monitor at 115200 baud for debugging.
3. Tap an unlinked card with no pairing session open → LCD should show
   `Not On The List`.
4. Start a pairing session from `/dashboard/attendance/me`, tap that same card within
   60s → should animate through the "linked" sequence.
5. Tap it again → `IN`. Tap again → `OUT`.

## What this replaced

This used to be Google-Sheets/Apps-Script-backed, with every card's UID hardcoded in
a `Student[]` array in firmware — meaning re-assigning a card meant re-flashing the
device, and the firmware's copy of the roster had already drifted from the website's
own copy (different UIDs, different domain spellings like `MCSOD` vs `MCSOCD`). Every
tap also cost two sequential Apps Script HTTP round-trips (one to check current
status, one to log the new one), which is why it used to feel slow. None of that
exists anymore — one indexed Postgres query per tap, and UID↔person binding lives in
the database, not in compiled firmware.
