#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>  // configTime/time() for the NTP sync the pinned cert depends on

// WiFi credentials and the device bearer secret live in secrets.h, which is
// gitignored — this repo is public, so nothing that grants network/API access goes
// in main.ino. Copy secrets.example.h to secrets.h and fill in real values before
// flashing (see attendance/README.md).
#include "secrets.h"

/* ── RFID ─────────────────────────────────── */
#define SS_PIN 21
#define RST_PIN 22
MFRC522 rfid(SS_PIN, RST_PIN);

/* ── LCD ──────────────────────────────────── */
LiquidCrystal_I2C lcd(0x3F, 16, 2);

// Declared globally (not inside sendTap()) and reused across every request. A fresh
// WiFiClientSecure means a fresh TLS handshake — the slowest part of each tap, often
// 500ms-1s+ on ESP32 — so keeping one connection alive across taps is what actually
// makes back-to-back taps feel instant, not just cosmetic loading text.
WiFiClientSecure secureClient;

/* ── Pinned trust root ────────────────────────────────────────────────────
   ISRG Root X1 (Let's Encrypt), the root the site's certificate chains to:
   leaf -> YR1 -> Root YR -> ISRG Root X1. Valid until 2035-06-04.

   This replaces setInsecure(). Without cert validation, anyone who can get the
   device to talk to them — a rogue AP answering for our host — is handed
   DEVICE_SECRET in the Authorization header, which is enough to forge taps for the
   whole team. WPA2 on the AP raises that bar but doesn't remove it: the pre-shared
   key is on every phone in the lab, so "on our WiFi" is not a trust boundary.

   Two consequences worth knowing before you debug a "why is every tap failing":
   1. If the site is ever moved off Let's Encrypt, this must be reflashed. That's
      the cost of pinning — verify with:
      openssl s_client -connect www.srmteamrobocon.com:443 -showcerts
   2. Certificate validation checks notBefore/notAfter, so the device needs a real
      clock. The ESP32 boots at 1970, which is "before" every cert — hence the NTP
      sync in ensureOnline(). Skipping it makes every handshake fail. */
const char* ISRG_ROOT_X1 = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAwTzELMAkG
A1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2VhcmNoIEdyb3VwMRUw
EwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4WhcNMzUwNjA0MTEwNDM4WjBP
MQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3Jv
dXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
ggIBAK3oJHP0FDfzm54rVygch77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj
/RQSa78f0uoxmyF+0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7i
S4+3mX6UA5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyHB5T0Y3Hs
LuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UCB5iPNgiV5+I3lg02
dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUvKBds0pjBqAlkd25HN7rOrFle
aJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWnOlFuhjuefXKnEgV4We0+UXgVCwOPjdAv
BbI+e0ocS3MFEvzG6uBQE3xDk3SzynTnjh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymC
zLq9gwQbooMDQaHWBfEbwrbwqHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC
1CLQJ13hef4Y53CIrU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIB
BjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZLubhzEFnT
IZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ3BebYhtF8GaV0nxv
wuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KKNFtY2PwByVS5uCbMiogziUwt
hDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5ORAzI4JMPJ+GslWYHb4phowim57iaztX
OoJwTdwJx4nLCgdNbOhdjsnvzqvHu7UrTkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIu
vtd7u+Nxe5AW0wdeRlN8NwdCjNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1N
bdWhscdCb+ZAJzVcoyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4k
qKOJ2qxq4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57demyPxgcY
xn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

/* ── Backend ──────────────────────────────────────────────────────────────
   Card UIDs are no longer hardcoded here — they're bound to a member's
   account via self-service pairing from the website dashboard. This device
   just forwards taps to one endpoint and shows whatever it says back.

   Must be the canonical host — srmteamrobocon.com (no www) 307-redirects here, and
   ESP32's HTTPClient doesn't follow POST redirects by default (see
   setFollowRedirects below, which is a defensive fallback, not a substitute for
   the right URL). Give each physical scanner its own deviceId if you add more
   than one. */
const char* tapURL = "https://www.srmteamrobocon.com/api/attendance/tap";
const char* deviceId = "lobby-scanner-1";

String lastUID = "";
unsigned long lastScanTime = 0;
const unsigned long DEBOUNCE_MS = 3000;

/* ── Minimal JSON field readers ─────────────────────────────────────────
   We control both ends of this API and the response is always a small,
   fixed shape, so a full parser (ArduinoJson) isn't worth the dependency. */
String extractJsonString(const String& json, const String& key) {
  String pattern = "\"" + key + "\":\"";
  int start = json.indexOf(pattern);
  if (start == -1) return "";
  start += pattern.length();
  int end = json.indexOf("\"", start);
  if (end == -1) return "";
  return json.substring(start, end);
}

bool extractJsonBool(const String& json, const String& key) {
  return json.indexOf("\"" + key + "\":true") != -1;
}

/* ── LCD message pools ────────────────────────────────────────────────────
   One of each gets picked at random (ESP32's random() is hardware-seeded —
   no randomSeed() needed). Diagnostic states (no signal / server error /
   generic error) only randomize the flavor line — the actual code or event
   string stays on the other line, since that's what you want to read off
   the screen when a scanner is actually broken. */
struct LcdMsg { const char* line1; const char* line2; };

const LcdMsg IDLE_MSGS[] = {
  {"Tap In Bestie", "SRM Robocon"},
  {"Yo Tap That", "Lets Gooo"},
  {"Scan Ur Card", "No Cap"},
  {"Ready When U R", "SRM Robocon"},
  {"Who Dis? Tap In", "Find Out"},
};

const LcdMsg CHECKING_MSGS[] = {
  {"Checking Vibes", "hold up..."},
  {"One Sec Bestie", "loading..."},
  {"Hold My Beer", "checking..."},
  {"Vibe Check", "pls wait..."},
  {"Lemme See", "one sec..."},
};

const LcdMsg UNAUTHORIZED_MSGS[] = {
  {"Not On The List", "Sry Bestie"},
  {"Fuck Off Dude", "No Cap"},
  {"Nice Try Buddy", "Try Again"},
  {"Who Tf Is This", "Not Today"},
};

const char* NO_SIGNAL_VIBES[] = {"No Signal Fam", "Lost In Space", "Wifi Ghosted Us", "Cant Even Rn"};
const char* SERVER_ERR_VIBES[] = {"Server Yikes", "Server Said Nah", "Big Oof Fr", "Not Vibing Rn"};
const char* GENERIC_ERR_VIBES[] = {"Big Yikes", "Oop Error", "Not Todayyy", "Sumthin Broke"};

const char* IN_VIBES[] = {
  "Welcome Dawg", "Lesgooo", "Ur In Cutie", "Locked In Bb",
  "Welcome Back", "Ayyy Ur In", "In The Building", "Slay Ur In",
};
const char* OUT_VIBES[] = {
  "Fuck Off Dude", "Byeee Bestie", "Ghosted Lol", "Cya Nerd",
  "Dipped Out", "Later Gator", "Peace Out", "Get Home Safe",
};
const char* LINKED_REVEALS[] = {"ONLINE", "LOCKED IN", "VERIFIED", "ACTIVATED", "LEGIT NOW"};

#define ARRAY_LEN(arr) (sizeof(arr) / sizeof((arr)[0]))

/* ── Signal badge ─────────────────────────────────────────────────────────
   The last two columns of the bottom row always show WiFi quality as 0-99,
   higher is better. It's the one number that explains most field problems
   (a scanner "being slow" is nearly always a scanner at 30), and it's on every
   screen so it's still there while you're staring at a failing tap.

   Two columns is the whole budget, hence the cap at 99 rather than 100, and
   "--" when we're not associated at all — which is meaningfully different from
   being associated with a terrible signal, and worth telling apart at a glance. */
// How long an IN/OUT result stays readable. This is a hold, not a delay() — a card
// tapped during it is read immediately and replaces the screen, so a longer, easier
// to read result costs nothing in throughput for a queue of people.
const unsigned long RESULT_HOLD_MS = 4000;
unsigned long resultUntilMs = 0;

const int BADGE_COL = 14;
const unsigned long BADGE_REFRESH_MS = 5000;
unsigned long lastBadgeMs = 0;

String wifiBadge() {
  if (WiFi.status() != WL_CONNECTED) return "--";

  // RSSI is roughly -50 dBm (excellent) to -100 dBm (unusable); the doubling is the
  // conventional linear map onto a percentage.
  long rssi = WiFi.RSSI();
  int quality = 2 * (int)(rssi + 100);
  if (quality > 99) quality = 99;
  if (quality < 0) quality = 0;

  String out = String(quality);
  if (out.length() < 2) out = " " + out;  // right-align so it hugs the edge
  return out;
}

// Redraws just the two badge columns. No lcd.clear(), so it can run on a screen
// that's already up without flicker.
void drawBadge() {
  lastBadgeMs = millis();
  lcd.setCursor(BADGE_COL, 1);
  lcd.print(wifiBadge());
}

void showMessage(const String& line1, const String& line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  // Truncated to BADGE_COL, not 16, to keep the badge's columns free. No current
  // message is that long, and error screens put their HTTP code at the left of this
  // line, so nothing readable gets clipped.
  lcd.print(line2.substring(0, BADGE_COL));
  drawBadge();
}

/* ── Getting online ───────────────────────────────────────────────────────
   Two things have to succeed before a tap can be sent, and they fail
   independently:

     1. ASSOCIATE with the access point — a plain WPA2-Personal SSID + password.
     2. SET THE CLOCK over NTP, because the pinned certificate can't be validated
        against a device that thinks it's 1970. Skipping this makes every TLS
        handshake fail, which looks exactly like the network being down.

   Both are re-checked before every tap rather than done once in setup(): APs
   reboot, DHCP leases lapse, and this device sits idle for hours between taps.
   There is one network and no backup — a fallback pointing at a router that never
   answers buys nothing but a 20s stall on every reconnect. */
const unsigned long WIFI_ATTEMPT_TIMEOUT_MS = 20000;
const unsigned long CLOCK_SYNC_TIMEOUT_MS = 10000;
// Any timestamp after 2020 proves NTP replied rather than the RTC still being at boot.
const time_t CLOCK_SANITY_EPOCH = 1600000000;

bool clockSynced = false;

// Poll until associated or out of time.
bool awaitConnection(unsigned long timeoutMs) {
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(250);
  }
  return WiFi.status() == WL_CONNECTED;
}

bool connectWifi() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  return awaitConnection(WIFI_ATTEMPT_TIMEOUT_MS);
}

// Needed for certificate validity checks — see the ISRG_ROOT_X1 comment.
bool syncClock() {
  if (clockSynced) return true;
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  unsigned long start = millis();
  while (time(nullptr) < CLOCK_SANITY_EPOCH && millis() - start < CLOCK_SYNC_TIMEOUT_MS) {
    delay(200);
  }
  clockSynced = time(nullptr) >= CLOCK_SANITY_EPOCH;
  if (!clockSynced) {
    // Deliberately not falling back to setInsecure() here: silently dropping to an
    // unvalidated connection is the exact failure this pinning exists to prevent.
    // Better a visible error than a quiet downgrade.
    Serial.println("clock: NTP sync failed — TLS will reject certs until this works.");
  }
  return clockSynced;
}

/* Cheap no-op once everything's up, so it's safe to call on every tap. */
bool ensureOnline() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi down — reconnecting...");
    if (!connectWifi()) {
      Serial.println("WiFi association failed.");
      return false;
    }
    Serial.println("Connected: " + WiFi.localIP().toString());
  }
  return syncClock();
}

/* ── Setup ────────────────────────────────── */
void setup() {
  Serial.begin(115200);

  Wire.begin(33, 32);
  lcd.init();
  lcd.backlight();

  // Pin the trust root before the first request. Must happen before ensureOnline(),
  // which does an NTP sync that this validation depends on.
  secureClient.setCACert(ISRG_ROOT_X1);

  lcd.print("Linking Up...");
  // Boot even if the network is down: the scanner still comes up and shows a clear
  // error per tap, and ensureOnline() retries from loop(). Better than a blank screen
  // and a silent reboot loop when the router is having a day.
  if (!ensureOnline()) {
    showMessage("No Wifi Fam", "will retry...");
    delay(2000);
  }

  lcd.clear();
  lcd.print("Locked & Loaded");

  SPI.begin();
  rfid.PCD_Init();

  delay(1500);
  LcdMsg idle = IDLE_MSGS[random(ARRAY_LEN(IDLE_MSGS))];
  showMessage(idle.line1, idle.line2);
}

/* ── POST one tap, return the raw JSON response body (or "" on failure) ──
   httpCode is filled in either way so the caller can tell "never reached the
   server" (negative, from HTTPClient itself) apart from "server answered
   with something other than 200" (a real status code — 404 means this route
   isn't deployed yet, 401 means deviceSecret doesn't match the server's
   ATTENDANCE_DEVICE_SECRET). */
String sendTap(const String& uid, int& httpCode) {
  // Was the TLS connection still alive from the last tap? setReuse(true) keeps it
  // open, but a socket idle for hours gets dropped by the far end — so in practice
  // most real taps pay a full handshake, and with a pinned root that means verifying
  // a three-cert chain ending in RSA-4096. Knowing which case you're in is the
  // difference between optimising the device and optimising the server.
  bool reused = secureClient.connected();
  unsigned long tStart = millis();

  HTTPClient http;
  http.begin(secureClient, tapURL);
  // Reuse the underlying TCP+TLS connection across taps instead of tearing it down
  // after every request — that's the single biggest win for making back-to-back
  // taps feel instant, since it skips re-negotiating TLS each time.
  http.setReuse(true);
  // Defensive: tapURL above should already be the canonical (non-redirecting) host,
  // but if that ever changes, STRICT mode follows 307/308 without turning the POST
  // into a GET (unlike the default, which doesn't follow redirects at all).
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_SECRET);

  String body = String("{\"uid\":\"") + uid + "\",\"deviceId\":\"" + deviceId + "\"}";
  httpCode = http.POST(body);

  String response = "";
  if (httpCode == 200) {
    response = http.getString();
  } else {
    Serial.println("Tap request failed, HTTP code: " + String(httpCode));
    Serial.println("Response: " + http.getString());
  }
  http.end();

  Serial.println("timing: sendTap=" + String(millis() - tStart) + "ms reusedTLS=" + String(reused ? "yes" : "no"));
  return response;
}

/* ── Loop ─────────────────────────────────── */
void loop() {
  // The idle screen can sit untouched for hours; a frozen signal number is worse
  // than no number, so refresh it in place.
  if (millis() - lastBadgeMs > BADGE_REFRESH_MS) drawBadge();

  // Retire a finished result screen. Doing this here rather than with a delay() at
  // the end of the tap is what lets the next person tap straight into it.
  if (resultUntilMs != 0 && millis() > resultUntilMs) {
    resultUntilMs = 0;
    LcdMsg back = IDLE_MSGS[random(ARRAY_LEN(IDLE_MSGS))];
    showMessage(back.line1, back.line2);
  }

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  // Zero-pad every byte to two hex digits. String(b, HEX) drops the leading zero on
  // anything below 0x10, which makes the joined string ambiguous — {04,A1,B2,C3} and
  // {4A,1B,2C,03} both render as "4a1b2c3". Two different cards collapsing onto one
  // identity means one member silently taps in as another, which is exactly the class
  // of drift this whole system was rebuilt to eliminate.
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  // Client-side debounce is just a courtesy — the server enforces its own,
  // authoritative debounce regardless of what this device thinks happened.
  if (uid == lastUID && millis() - lastScanTime < DEBOUNCE_MS) return;
  lastUID = uid;
  lastScanTime = millis();

  LcdMsg checking = CHECKING_MSGS[random(ARRAY_LEN(CHECKING_MSGS))];
  showMessage(checking.line1, checking.line2);

  unsigned long tTapStart = millis();
  int httpCode = 0;
  String response = "";
  if (ensureOnline()) {
    unsigned long tOnline = millis() - tTapStart;
    Serial.println("timing: ensureOnline=" + String(tOnline) + "ms");
    response = sendTap(uid, httpCode);
  } else {
    // Negative code so the branch below reads this the same as any other
    // never-reached-the-server failure.
    httpCode = -1;
  }

  if (response == "") {
    // Negative = never reached the server (WiFi/DNS/TLS). A positive code
    // that isn't 200 means the server answered but rejected the request —
    // 404 = this route isn't deployed yet, 401 = wrong deviceSecret. Codes
    // stay on-screen (not just flavor text) since they're the first thing
    // you'll want to read off when debugging a scanner in the field.
    const char* vibe = httpCode < 0
      ? NO_SIGNAL_VIBES[random(ARRAY_LEN(NO_SIGNAL_VIBES))]
      : SERVER_ERR_VIBES[random(ARRAY_LEN(SERVER_ERR_VIBES))];
    showMessage(vibe, String(httpCode));
  } else if (!extractJsonBool(response, "ok")) {
    String event = extractJsonString(response, "event");
    if (event == "unauthorized") {
      LcdMsg m = UNAUTHORIZED_MSGS[random(ARRAY_LEN(UNAUTHORIZED_MSGS))];
      showMessage(m.line1, m.line2);
    } else {
      showMessage(GENERIC_ERR_VIBES[random(ARRAY_LEN(GENERIC_ERR_VIBES))], event);
    }
  } else {
    String event = extractJsonString(response, "event");
    String name = extractJsonString(response, "name");
    if (event == "linked") {
      // A little HUD-style boot sequence instead of a flat "Card Linked!" —
      // this is the moment someone's card goes live, worth a beat of drama.
      for (int i = 0; i < 3; i++) {
        String dots = "";
        for (int d = 0; d <= i; d++) dots += ".";
        showMessage(name + " is...", "syncing" + dots);
        delay(300);
      }
      showMessage(name + " is", LINKED_REVEALS[random(ARRAY_LEN(LINKED_REVEALS))]);
    } else {
      String action = extractJsonString(response, "action");
      const char* vibe = action == "IN"
        ? IN_VIBES[random(ARRAY_LEN(IN_VIBES))]
        : OUT_VIBES[random(ARRAY_LEN(OUT_VIBES))];
      showMessage(vibe, name);
    }
  }

  Serial.println("timing: TOTAL tap->screen=" + String(millis() - tTapStart) + "ms");
  Serial.println(response);

  // Hand the result screen to the timer at the top of loop() instead of blocking
  // here. The reader stays live throughout, so back-to-back taps by different people
  // are picked up instantly.
  resultUntilMs = millis() + RESULT_HOLD_MS;
}
