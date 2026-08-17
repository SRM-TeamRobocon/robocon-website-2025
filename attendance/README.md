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

Four things live in Supabase, on top of the existing `member_accounts` / `members`
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
- **`overnight_passes`** — one row per "I'm staying overnight" opt-in, exempting that
  member from exactly one midnight auto-checkout sweep. See
  [Staying overnight](#staying-overnight) below for why the one-night guarantee is
  enforced through `status` rather than timestamps.

## The tap flow, step by step

1. Card touches the reader. `main.ino` reads the UID (`rfid.uid.uidByte[]`), formats
   it as an uppercase hex string with **every byte zero-padded to two digits**.

   The padding is load-bearing, and older firmware got it wrong: `String(b, HEX)`
   drops the leading zero on anything below `0x10`, so the joined string was
   ambiguous — `{04,A1,B2,C3}` and `{4A,1B,2C,03}` both came out as `4A1B2C3`. Two
   cards collapsing onto one identity means one member silently taps in as another.
   **Any card paired before this fix has the old unpadded string in
   `member_accounts.rfid_uid` and will read as unrecognised** — those members just
   hit "Link my RFID card" once more and tap; pairing overwrites the column.
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
`CRON_SECRET`, scheduled `30 18 * * *` = midnight IST) that force-closes anyone still
`IN` at day's end, so nobody's "session" silently runs for days if they forget to tap
out and never notice.

## Staying overnight

The midnight sweep would otherwise punish exactly the people you least want to
punish — whoever's still in the lab at 3am before a competition. So there's an opt-in
on `/dashboard/attendance/me`: hit **I'm staying overnight** (optional one-line
reason) and `POST /api/member/attendance/overnight` writes an `overnight_passes` row.
Self-serve, no lead approval — nobody's awake at 2am to approve one. `DELETE` on the
same route cancels it.

A pass is good for **exactly one night**, and that guarantee comes from `status`,
deliberately not from clock math:

- Each sweep loads every `active` pass. Members holding one are skipped (no
  `auto_checkout` row is written for them at all, so they don't land on the ghost
  board either).
- The same sweep then **resolves every pass it saw** — `used` for the people it
  actually kept checked in, `expired` for anyone who'd claimed one but tapped out
  normally. So no pass can still be `active` when tomorrow's sweep runs.
- `expires_at` (26h) is only a backstop for the day the cron doesn't fire at all;
  without it a pass claimed during an outage would sit `active` forever.

If you're still `IN` at the *next* midnight, you get swept out like anyone else — a
real overnight ends with a tap out in the morning. `night_of` on the row is a display
label only ("pass active for the night of the 17th"), never a decision input; a
partial unique index (`overnight_passes_one_active_idx`) keeps a member to one live
pass so double-clicks and second tabs can't stack them.

The board shows an indigo **Overnight** badge for anyone currently `IN` with a live
pass, and `/api/member/attendance/me` suppresses its "forgot to tap out?" nudge while
one is held.

## Ghost board

`/dashboard/attendance` ranks members by how many times the midnight sweep had to
close a session for them — i.e. how often they walked out without tapping out.
All-time, visible to everyone on the board (it's meant to be mildly embarrassing).

The count is just `attendance_logs` rows with `source = 'auto_checkout'`, grouped per
member — no separate counter to keep in sync, and nights covered by an overnight pass
can't show up because no row was ever written for them. Note this query is all-time
while the rest of the board is a 60-day window, so `/api/attendance` resolves names
across the union of both ID sets (someone can be on the ghost board with no recent
taps) and caps the scan at 5000 rows.

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

- **WiFi + LCD + RFID init** (`setup()`) — brings up WiFi (see below), initializes the
  LCD and the MFRC522 reader, then sits on an idle screen. It no longer blocks forever
  waiting for WiFi: if the network is down the scanner still boots, shows a clear
  error per tap, and keeps retrying.
- **`ensureOnline()`** — getting this device onto the campus network is three
  separate things that fail independently, which is why they're three functions:

  1. **Associate** (`associateCampus()`). SRMIST is **WPA2-Enterprise
     (PEAP/MSCHAPv2)**, so this is the real login — `EAP_USERNAME` being non-empty in
     `secrets.h` is what selects that path. Joining an open or pre-shared-key SSID is
     also supported (blank `EAP_USERNAME`, optionally set `CAMPUS_PASSWORD`), because
     SRM runs an open guest SSID alongside the 802.1X one and moving the scanner
     between them should be a `secrets.h` edit, not a code change. Note that the
     enterprise API **changed in Arduino-ESP32 3.x** (`esp_eap_client.h` +
     `esp_eap_client_set_*` vs `esp_wpa2.h` + `esp_wifi_sta_wpa2_ent_*` on 2.x);
     `main.ino` `#if`s on `ESP_ARDUINO_VERSION_MAJOR` so it builds on either. "Not
     declared in this scope" here is a core-version mismatch, not a bug.

     **There is exactly one network and no backup.** The old `SRM TEAM ROBOCON` lab
     router used to be a fallback; it's dead, and a fallback pointing at a network
     that never answers costs a 20s stall on every reconnect while buying nothing. If
     a working backup router ever appears, re-adding it is a small change — a second
     `WiFi.begin` path in `ensureOnline()` — but don't re-add one on spec.
  2. **Authenticate to the captive portal** (`portalLogin()`) — **currently a no-op**,
     because `PORTAL_HOST` is empty. SRMIST has no portal: verified 2026-08-17, a
     plain `http://` request returns 200 with no redirect and the gateway has nothing
     listening on 8090/80/443/8080. The step exists because the *guest/hostel* SSID
     is an open network with a browser login, and if the scanner ever has to live
     there, association succeeding tells you nothing — the AP hands out an IP and
     then swallows every packet until you log in. A human does that in a browser; the
     scanner posts the same form itself.
  3. **Set the clock** (`syncClock()`). The pinned certificate can't be validated by
     a device that thinks it's 1970, and NTP is itself blocked until step 2 finishes
     — so the ordering is load-bearing, not incidental.

  All three are re-checked before *every* tap rather than once at boot, because
  portal sessions expire on idle and this device is idle for hours between taps. It's
  a cheap no-op when everything's already up.

- **`portalRequest()` / `portalKeepAlive()`** — SRM runs a Sophos/Cyberoam portal,
  whose browser page posts a urlencoded form to `http://<host>:8090/login.xml`:
  `mode=191` login, `192` keepalive, `193` logout (`a` is just a cache-buster, so
  `millis()` is fine — this runs before the clock is set). Sessions die of idleness,
  so `loop()` re-pings every 150s, before the "no card present" early return.

  **If the portal speaks something else, `portalRequest()` is the only function that
  changes.** Capture the real login request from a browser's network tab and match
  it; the raw response body is always printed to Serial for that purpose. A
  `LIMIT_REACHED` response is recognised separately because "your account is already
  logged in on too many devices" otherwise looks identical to a wrong password.

- **`wifiBadge()` / `drawBadge()`** — the last two columns of the bottom row always
  show WiFi quality as `0`-`99`, higher is better (the usual `2 × (RSSI + 100)` map,
  capped at 99 because two columns is the entire budget). `--` means not associated
  at all, which is worth telling apart from "associated with an awful signal". It's
  on every screen, so it's still readable while you're looking at a failed tap — a
  scanner that's "being slow" is nearly always a scanner sitting at 30.

  `showMessage()` truncates line 2 at column 14 rather than 16 to keep those columns
  free; no message is that long today, and error screens put their HTTP code at the
  left of that line, so nothing readable gets clipped. `loop()` also redraws just
  those two columns every 5s — no `lcd.clear()`, so no flicker — because the idle
  screen can otherwise sit for hours showing a stale number.

- **Certificate pinning** — `secureClient.setCACert(ISRG_ROOT_X1)` replaced
  `setInsecure()`. On an **open** network, no cert validation means anyone in range
  can stand up a rogue AP, answer for our host, and be handed `DEVICE_SECRET` in the
  `Authorization` header — enough to forge taps for the entire team. The site's chain
  is `leaf → YR1 → Root YR → ISRG Root X1`, so the Let's Encrypt root is what's
  pinned (valid to 2035). The cost: **if the site ever moves off Let's Encrypt, the
  scanner stops working until it's reflashed.** Verify the chain with
  `openssl s_client -connect www.srmteamrobocon.com:443 -showcerts`.

  `syncClock()` deliberately does *not* fall back to `setInsecure()` when NTP fails —
  silently downgrading to an unvalidated connection on an open network is the exact
  thing the pinning exists to prevent, so it fails visibly instead.
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

This repo is public, so network credentials and the device bearer secret live in
`attendance/secrets.h` — gitignored, never committed. `main.ino` does
`#include "secrets.h"` and reads `CAMPUS_SSID`, `CAMPUS_PASSWORD`, `EAP_*`,
`PORTAL_*` and `DEVICE_SECRET` from it. `attendance/secrets.example.h`
is the committed template — copy it to `secrets.h` and fill in real values before
flashing. **Only `secrets.h` gets real values**; the example file is published on
every push, netid included.

Because the campus network is per-user, `EAP_USERNAME`/`EAP_PASSWORD` are somebody's
**actual SRMIST login**, in plaintext on a device sitting in a shared lab that anyone
can walk up to and re-flash over USB. Use a dedicated/service account if the
department will issue one, and never an account that matters for anything else. The
cleanest outcome is asking the network admins for a **device/MAC registration** for
the scanner, so no personal credentials live on it at all.

If the scanner ever moves to the guest SSID with its browser login, the same warning
applies to `PORTAL_USERNAME`/`PORTAL_PASSWORD`, plus one more: portals cap concurrent
logins per account, so a scanner holding a session 24/7 will either block that
person's own laptop or get silently kicked when they log in elsewhere — and
attendance then quietly stops working until someone notices. If taps start failing
for no obvious reason there, check Serial for `LIMIT_REACHED` first.

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

## Building

`arduino-cli` requires the sketch folder to be named after the `.ino` file, and this
one is `main.ino` inside `attendance/` — so compiling in place fails. Stage it in a
folder called `main` first:

```bash
arduino-cli config add board_manager.additional_urls \
  https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
arduino-cli lib install "MFRC522" "LiquidCrystal I2C"

mkdir -p /tmp/main && cp attendance/main.ino attendance/secrets.h /tmp/main/
arduino-cli compile --fqbn esp32:esp32:esp32 /tmp/main
```

Verified building against **esp32:esp32 core 3.3.11** (2026-08-17): 83% of program
storage, 15% of dynamic memory. That flash figure is worth watching — there isn't
room for much more, and the fix if it overflows is a `huge_app` partition scheme, not
cutting features. The `LiquidCrystal I2C claims to run on avr architecture` warning is
expected and harmless.

Note that only the `ESP_ARDUINO_VERSION_MAJOR >= 3` half of the enterprise `#if` gets
compiled on a 3.x core; the 2.x branch is carried for older cores but isn't exercised
by this build.

## Flashing checklist

1. Copy `attendance/secrets.example.h` to `attendance/secrets.h` and fill in the real
   portal credentials and `DEVICE_SECRET` (must match `ATTENDANCE_DEVICE_SECRET` on
   the server). Keep real values **only** in `secrets.h` — `secrets.example.h` is
   committed to a public repo, so anything typed into it is published. In `main.ino`,
   confirm `tapURL` points at the deployed site's canonical host (watch out for `www`
   vs non-`www` redirects — POST doesn't survive a redirect the `HTTPClient` library
   doesn't know to follow).
2. Confirm which network you're targeting. On SRMIST (802.1X/PEAP) fill in `EAP_*`
   and leave `PORTAL_HOST` empty — that's the current setup. Only if you're putting
   the scanner on the open guest SSID do you need the portal: join it on a laptop,
   `curl -v http://neverssl.com`, read the IP out of the `Location:` redirect header
   into `PORTAL_HOST`, and blank the `EAP_*` fields.
3. Flash it, open the Serial monitor at 115200 baud. A healthy boot prints
   `Associated (campus): <ip>` (plus `Portal: authenticated.` only when a portal is
   configured). The LCD can only tell you a tap failed, never *why* — Serial is where
   the answer is:
   - `WiFi association failed`: EAP credentials are the first thing to check, and
     there's no backup network to mask it. The LCD shows the signal badge as `--`
     whenever it's unassociated.
   - `portal login -> HTTP …` with the raw body: the portal spoke, but didn't
     accept. Compare the body against what a browser sends.
   - `LIMIT_REACHED`: account already logged in elsewhere, not a wrong password.
   - `clock: NTP sync failed`: TLS will reject every cert until this works.
   - Taps failing with a negative code *after* a clean boot: usually the pinned
     cert, i.e. the site moved off Let's Encrypt.
3. Tap an unlinked card with no pairing session open → LCD should show
   `Not On The List`.
4. Start a pairing session from `/dashboard/attendance/me`, tap that same card within
   60s → should animate through the "linked" sequence.
5. Tap it again → `IN`. Tap again → `OUT`.
6. Claim an overnight pass from `/dashboard/attendance/me` while `IN`, then run the
   sweep by hand (`curl -H "Authorization: Bearer $CRON_SECRET"
   https://.../api/attendance/auto-checkout`) — you should stay `IN`, and the response
   should report `stayingOvernight: 1`. Run it a second time and you should be checked
   out, since the first run burned the pass.

## What this replaced

This used to be Google-Sheets/Apps-Script-backed, with every card's UID hardcoded in
a `Student[]` array in firmware — meaning re-assigning a card meant re-flashing the
device, and the firmware's copy of the roster had already drifted from the website's
own copy (different UIDs, different domain spellings like `MCSOD` vs `MCSOCD`). Every
tap also cost two sequential Apps Script HTTP round-trips (one to check current
status, one to log the new one), which is why it used to feel slow. None of that
exists anymore — one indexed Postgres query per tap, and UID↔person binding lives in
the database, not in compiled firmware.
