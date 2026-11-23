# RFID attendance scanner

ESP32 + MFRC522 + 16x2 I2C LCD. The upload-ready Arduino sketch is in `main/`.
Scanning does not wait for Wi-Fi, NTP, DNS, TLS or HTTP.

## Upload order

1. Apply `supabase/attendance-queued-taps.sql` to the intended database. It adds a
   private receipt table and a service-role-only ingest function; it does not
   delete or rewrite attendance history. This repo uses standalone SQL patches,
   not a verified migration chain: apply this patch explicitly.
2. Deploy the website changes, including `POST /api/attendance/queued-tap`.
   The server must have `ATTENDANCE_DEVICE_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`
   and `SUPABASE_SERVICE_ROLE_KEY` configured. Existing `/api/attendance/tap`
   devices remain supported.
3. Open `attendance/main/main.ino` in Arduino IDE, or compile/upload the
   `attendance/main` sketch directory with Arduino CLI.
   Install the ESP32 Arduino core, MFRC522 and LiquidCrystal I2C libraries.
   Preferences, FreeRTOS and WiFiMulti ship with the ESP32 core; no new library
   is needed.
4. Copy the `WIFI_NETWORKS` list from `main/secrets.example.h` into the gitignored
   `main/secrets.h`, then fill in each Wi-Fi SSID and password. Add or remove entries
   for the networks this scanner may use. Verify that `DEVICE_SECRET` matches
   the server secret. Real credentials belong only in `main/secrets.h`.
   Give each physical scanner a unique `deviceId` in `main/main.ino`.

No database patch, website deployment or device flash was performed by this change.

## Wiring

| Component | Pins |
| --- | --- |
| MFRC522 SS / RST | GPIO 21 / 22 |
| MFRC522 SPI | ESP32 default SPI pins, as before |
| LCD SDA / SCL | GPIO 33 / 32 |
| LCD address | `0x3F` |

## What happens on a scan

- The zero-padded uppercase UID, random 128-bit event ID and capture time are
  committed to ESP32 NVS flash before the LCD says `Saved locally`.
- One network task uploads queued taps in capture order. RFID and LCD stay on
  the main task, so a slow request does not hold up the next scan.
- The queue holds **64 pending taps**, including across a power loss. A full
  queue or failed flash write displays `NOT saved / retry`; existing taps are
  never overwritten. Only the occupied queue entries are written to NVS, so
  each update does not reserve space for 64 taps. Older full-size queue blobs
  remain readable. Do not erase flash/NVS while there are pending taps.
- Each request body is under 256 bytes; the four-line ASCII response is under
  100 bytes. HTTPS headers and TLS handshakes add traffic, especially after idle
  connections expire. Bandwidth figures alone cannot guarantee latency.
- The device keeps HTTPS certificate verification, disables Wi-Fi sleep, uses
  WiFiMulti to connect to an available saved network and backs failed uploads
  off to at most about 60 seconds.
  It sends no idle heartbeat or roster download. Wi-Fi association starts in
  the background, without the old per-scan 20-second connection wait.
- A matching server receipt is required before a tap is removed from flash.
  Receipt and attendance writes are one database transaction. A lost response,
  reboot or removal-write failure can safely resend the same event ID.
- `Confirmed IN/OUT` appears only after server confirmation. Unknown cards show
  `Link on website`. Server results for older scans do not replace the newest
  scan's screen, except when attention is needed for a review.

The LCD's bottom-right character on the second line shows Wi-Fi signal level
`1` (weakest) through `4` (strongest), or `-` when not associated. This measures
radio signal, not download speed. WPA2-Personal
network credentials are configured in `main/secrets.h`; enterprise login/captive
portals are not implemented. SSID spelling, capitalization and trailing spaces
must match exactly, and the ESP32 can only join a 2.4 GHz network. WiFiMulti
selects a saved network when connecting
or reconnecting. A working connection is kept even if another saved network has
a stronger signal. Slow internet and inability to join an access point are
separate problems.

## Time and delayed attendance

The ESP32 synchronises time using NTP in the background. After synchronisation,
it continues dating taps during an internet outage. Timestamps use milliseconds.
A scan before the first clock sync can be dated from monotonic uptime if the
same boot reaches NTP later. If power is lost first, its time cannot be recovered
without an external RTC; the original UID/event is retained for server review.

**Automatic sync covers current-day taps that do not precede later attendance.**
Taps from a previous IST calendar day, unknown capture times, a clock over 30
seconds ahead, or taps older than an already-recorded event are stored as
`review` receipts. They do not automatically toggle attendance. The LCD shows
`Needs review / Saved on server`. This avoids silently corrupting sessions after
midnight checkout, a manual correction, or another scanner's later tap.

Review receipts currently require an administrator to inspect them in SQL and
use the existing attendance correction tools. There is no new review UI:

```sql
select event_id, device_id, uid, scanned_at, received_at, result
from public.attendance_device_receipts
where result->>'event' = 'review'
order by received_at;
```

Keep receipts while a device might retry them. Deleting receipts removes the
idempotency guarantee for those old event IDs. Multiple queued-firmware devices
are serialised by the ingest function; legacy firmware and manual corrections
use their existing handlers. Avoid running legacy and new scanners concurrently
for the same cards during rollout. Historical conflict repair is not automatic.

The shared midnight reconciler now timestamps forced checkout at the IST
midnight boundary, rather than the time a delayed sweep runs. This allows a
new day's captured tap to follow that checkout correctly. The queued ingest
only debounces preceding RFID events, not a midnight checkout.

## Pairing and existing features

Names and domains still come from the server, not a firmware roster. Members
start pairing from `/dashboard/attendance/me`, then scan an unknown card while
online. Pairing requires delivery within 15 seconds and a window that already
existed at capture time. A stale queued unknown card cannot claim a later
pairing window. Only one pairing window should be active at a time, as before.

Attendance history, live board, self-correction, overnight passes and push
notifications remain server features. Live broadcast and optional push run after
the HTTP response for new successful events; duplicate retries do not notify
again. `ATTENDANCE_DEVICE_SECRET` is mandatory on the new endpoint, including
local development. Never put Supabase service-role credentials on the ESP32.

`main/trust-root.h` contains the existing ISRG Root X1 certificate. A change to the
site's certificate authority may require updating and reflashing this file.
Clock sync remains necessary for certificate validity checks. HTTPS is never
silently downgraded when NTP or certificate validation fails.

## Local checks

```powershell
node attendance/tests/run.cjs
g++ -std=c++11 -Wall -Wextra -Werror attendance/tests/tap-queue-test.cpp -o tmp/attendance/tap-queue-test.exe
./tmp/attendance/tap-queue-test.exe
npx.cmd tsc --noEmit
```

Create `tmp/attendance` first if necessary. Host tests cover queue ordering,
capacity, acknowledgment matching, byte restoration, input/protocol validation,
route authorization/retry responses and delayed midnight checkout timestamps.
They do not substitute for ESP32 compilation, NVS power-loss testing or database
transaction tests.

Before relying on the device, test normal pairing and IN/OUT, turn off the
connected access point and confirm it switches to a second saved network, then
turn off both networks and scan several cards. Restore one and check timestamps
and ordering. Interrupt power with pending scans, then test a request whose
response is lost after server commit. Also check a full queue, invalid
credentials, blocked NTP and an outage crossing midnight. Never treat
`Saved locally` as confirmed attendance.
