#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>  // configTime/time() for the NTP sync the pinned cert depends on

// WPA2-Enterprise (PEAP/MSCHAPv2) for the campus network. The header and function
// names changed when Arduino-ESP32 3.x moved to ESP-IDF 5 — this compiles on both.
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  #include <esp_eap_client.h>
#else
  #include <esp_wpa2.h>
#endif

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
// Plain HTTP, used only to talk to the captive portal (which lives inside the network
// and is http-only by design — you can't TLS to a box whose whole job is intercepting).
WiFiClient plainClient;

/* ── Pinned trust root ────────────────────────────────────────────────────
   ISRG Root X1 (Let's Encrypt), the root the site's certificate chains to:
   leaf -> YR1 -> Root YR -> ISRG Root X1. Valid until 2035-06-04.

   This replaces setInsecure(). Without cert validation, anyone who can get the
   device to talk to them — a rogue AP answering for our host — is handed
   DEVICE_SECRET in the Authorization header, which is enough to forge taps for the
   whole team. SRMIST being WPA2-Enterprise raises that bar (per-client session
   keys), but it doesn't remove it, and the guest SSID this device may end up on is
   wide open.

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
   Three separate things have to succeed before a tap can be sent, and they
   fail independently — which is why they're three functions and not one:

     1. ASSOCIATE with the access point. SRMIST is WPA2-Enterprise/PEAP (verified
        2026-08-17: EAP type "Protected EAP", security key absent), so this is the
        real login and EAP_USERNAME being set is what selects that path.
     2. AUTHENTICATE to the captive portal. A NO-OP on SRMIST, which has no portal
        — plain HTTP returns 200 with no redirect and the gateway has nothing on
        8090. It's here for the open guest/hostel SSID, where association
        "succeeding" tells you nothing because the AP hands out an IP and then
        swallows every packet until you log in. A normal user does that in a
        browser; this device has none, so it posts the same form itself.
     3. SET THE CLOCK over NTP, because the pinned certificate can't be validated
        against a device that thinks it's 1970. Behind a portal NTP is blocked
        until step 2 finishes, so the ordering stays load-bearing even though step
        2 is currently inert.

   Each is time-boxed and re-checked before every tap rather than done once in
   setup(): associations drop, portal sessions expire on idle, and this device is
   idle for hours between taps. */
const unsigned long WIFI_ATTEMPT_TIMEOUT_MS = 20000;
const unsigned long PORTAL_TIMEOUT_MS = 8000;
const unsigned long CLOCK_SYNC_TIMEOUT_MS = 10000;
// Sophos drops an idle session after a few minutes. Re-ping well inside that.
const unsigned long PORTAL_KEEPALIVE_MS = 150000;
// Any timestamp after 2020 proves NTP replied rather than the RTC still being at boot.
const time_t CLOCK_SANITY_EPOCH = 1600000000;

bool portalAuthed = false;
bool clockSynced = false;
unsigned long lastKeepAliveMs = 0;

bool portalConfigured() { return strlen(PORTAL_HOST) > 0; }

// Percent-encode for the portal's form body — passwords with @ / & / + in them
// would otherwise silently corrupt the request and look like "wrong password".
String urlEncode(const String& value) {
  String out = "";
  const char* hex = "0123456789ABCDEF";
  for (unsigned int i = 0; i < value.length(); i++) {
    char c = value.charAt(i);
    // Cast before isalnum: char is signed on this toolchain, so a non-ASCII byte in a
    // password would pass a negative value and land in undefined behaviour.
    if (isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' || c == '~') {
      out += c;
    } else {
      out += '%';
      out += hex[(c >> 4) & 0xF];
      out += hex[c & 0xF];
    }
  }
  return out;
}

// Shared tail of every connect path: poll until associated or out of time.
bool awaitConnection(unsigned long timeoutMs) {
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(250);
  }
  return WiFi.status() == WL_CONNECTED;
}

/* The only network. EAP_USERNAME set = WPA2-Enterprise (the SRMIST case); otherwise
   we join CAMPUS_SSID openly (empty CAMPUS_PASSWORD) or with a pre-shared key. Both
   exist because SRM runs an 802.1X SSID and an open guest one side by side — moving
   the scanner between them is a secrets.h edit, not a code change.

   There is deliberately no backup network: the lab router that used to fill that
   role is dead, and a fallback pointing at a network that never answers buys nothing
   but a 20s stall on every reconnect. */
bool associateCampus() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_STA);

  if (strlen(EAP_USERNAME) > 0) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    esp_eap_client_set_identity((uint8_t*)EAP_IDENTITY, strlen(EAP_IDENTITY));
    esp_eap_client_set_username((uint8_t*)EAP_USERNAME, strlen(EAP_USERNAME));
    esp_eap_client_set_password((uint8_t*)EAP_PASSWORD, strlen(EAP_PASSWORD));
    esp_wifi_sta_enterprise_enable();
#else
    esp_wifi_sta_wpa2_ent_set_identity((uint8_t*)EAP_IDENTITY, strlen(EAP_IDENTITY));
    esp_wifi_sta_wpa2_ent_set_username((uint8_t*)EAP_USERNAME, strlen(EAP_USERNAME));
    esp_wifi_sta_wpa2_ent_set_password((uint8_t*)EAP_PASSWORD, strlen(EAP_PASSWORD));
    esp_wifi_sta_wpa2_ent_enable();
#endif
    WiFi.begin(CAMPUS_SSID);
  } else if (strlen(CAMPUS_PASSWORD) > 0) {
    WiFi.begin(CAMPUS_SSID, CAMPUS_PASSWORD);
  } else {
    WiFi.begin(CAMPUS_SSID);
  }

  return awaitConnection(WIFI_ATTEMPT_TIMEOUT_MS);
}

/* Sophos/Cyberoam captive portal — unused on SRMIST (no portal there), kept for the
   open guest/hostel SSID. Its browser page posts a urlencoded form to /login.xml on
   port 8090; mode 191 = login, 192 = keepalive, 193 = logout. `a` is just a
   cache-buster, so millis() is fine — this runs before the clock is set.

   This is UNVERIFIED against the real guest portal: it's the standard Sophos shape,
   not something observed on campus. If it speaks something else, this one function
   is what changes — capture the real request from a browser's network tab and match
   it. The raw response body is always printed to Serial for exactly that purpose. */
bool portalRequest(int mode, const char* label) {
  HTTPClient http;
  String url = String("http://") + PORTAL_HOST + ":" + String(PORTAL_PORT) + "/login.xml";
  http.begin(plainClient, url);
  http.setTimeout(PORTAL_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String body = "mode=" + String(mode) +
                "&username=" + urlEncode(PORTAL_USERNAME) +
                "&password=" + urlEncode(PORTAL_PASSWORD) +
                "&a=" + String(millis()) +
                "&producttype=0";

  int code = http.POST(body);
  String response = code > 0 ? http.getString() : "";
  http.end();

  Serial.println(String("portal ") + label + " -> HTTP " + String(code) + " " + response);

  // Sophos answers with <status>LIVE</status> on success. LIMIT_REACHED means the
  // account is already logged in on too many devices somewhere else — worth
  // recognising separately because it looks exactly like a wrong password otherwise.
  if (code != 200) return false;
  if (response.indexOf("LIMIT_REACHED") != -1) {
    Serial.println("portal: account session limit reached — log another device out.");
    return false;
  }
  return response.indexOf("LIVE") != -1 || response.indexOf("successfully") != -1;
}

bool portalLogin() {
  if (!portalConfigured()) return true;  // nothing to log into
  bool ok = portalRequest(191, "login");
  if (ok) lastKeepAliveMs = millis();
  return ok;
}

// Fire-and-forget: a failed keepalive just means the next tap re-logs in.
void portalKeepAlive() {
  if (!portalAuthed || !portalConfigured()) return;
  if (millis() - lastKeepAliveMs < PORTAL_KEEPALIVE_MS) return;
  lastKeepAliveMs = millis();
  if (!portalRequest(192, "keepalive")) portalAuthed = false;
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
    portalAuthed = false;
    Serial.println("WiFi down — reconnecting...");
    if (!associateCampus()) {
      Serial.println("WiFi association failed.");
      return false;
    }
    Serial.println("Associated: " + WiFi.localIP().toString());
  }

  if (!portalAuthed && portalConfigured()) {
    if (!portalLogin()) return false;
    portalAuthed = true;
    Serial.println("Portal: authenticated.");
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
  // and a silent reboot loop when the campus portal is having a day.
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
  return response;
}

/* ── Loop ─────────────────────────────────── */
void loop() {
  // Runs on every pass, before the early return below — a portal session dies of
  // idleness, and this device is idle far more than it's tapped. Self-rate-limited
  // to PORTAL_KEEPALIVE_MS internally.
  portalKeepAlive();

  // The idle screen can sit untouched for hours; a frozen signal number is worse
  // than no number, so refresh it in place.
  if (millis() - lastBadgeMs > BADGE_REFRESH_MS) drawBadge();

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

  int httpCode = 0;
  String response = "";
  if (ensureOnline()) {
    response = sendTap(uid, httpCode);

    // A negative code behind a captive portal usually means the session lapsed
    // between taps rather than the network being down — the portal just swallowed
    // the request. Re-auth and retry once, while the member is still standing there,
    // instead of making them tap twice.
    if (response == "" && httpCode < 0 && portalConfigured()) {
      Serial.println("Tap failed — reauthenticating with portal and retrying.");
      portalAuthed = false;
      if (ensureOnline()) response = sendTap(uid, httpCode);
    }
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

  Serial.println(response);

  // Shorter hold than before — this is dead time between "result shown" and "ready
  // for the next tap", not something the network latency requires.
  delay(1200);
  LcdMsg idle = IDLE_MSGS[random(ARRAY_LEN(IDLE_MSGS))];
  showMessage(idle.line1, idle.line2);
}
