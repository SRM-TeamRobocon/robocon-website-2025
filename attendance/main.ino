#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

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

void showMessage(const String& line1, const String& line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, 16));
}

/* ── Setup ────────────────────────────────── */
void setup() {
  Serial.begin(115200);

  Wire.begin(33, 32);
  lcd.init();
  lcd.backlight();

  lcd.print("Linking Up...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  lcd.clear();
  lcd.print("Locked & Loaded");

  SPI.begin();
  rfid.PCD_Init();

  delay(1500);
  showMessage("Tap In Bestie", "SRM Robocon");
}

/* ── POST one tap, return the raw JSON response body (or "" on failure) ──
   httpCode is filled in either way so the caller can tell "never reached the
   server" (negative, from HTTPClient itself) apart from "server answered
   with something other than 200" (a real status code — 404 means this route
   isn't deployed yet, 401 means deviceSecret doesn't match the server's
   ATTENDANCE_DEVICE_SECRET). */
String sendTap(const String& uid, int& httpCode) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, tapURL);
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
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++)
    uid += String(rfid.uid.uidByte[i], HEX);
  uid.toUpperCase();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  // Client-side debounce is just a courtesy — the server enforces its own,
  // authoritative debounce regardless of what this device thinks happened.
  if (uid == lastUID && millis() - lastScanTime < DEBOUNCE_MS) return;
  lastUID = uid;
  lastScanTime = millis();

  showMessage("Checking Vibes", "hold up...");
  int httpCode = 0;
  String response = sendTap(uid, httpCode);

  if (response == "") {
    // Negative = never reached the server (WiFi/DNS/TLS). A positive code
    // that isn't 200 means the server answered but rejected the request —
    // 404 = this route isn't deployed yet, 401 = wrong deviceSecret. Codes
    // stay on-screen (not just flavor text) since they're the first thing
    // you'll want to read off when debugging a scanner in the field.
    showMessage(httpCode < 0 ? "No Signal Fam" : "Server Yikes", String(httpCode));
  } else if (!extractJsonBool(response, "ok")) {
    String event = extractJsonString(response, "event");
    showMessage(event == "unauthorized" ? "Not On The List" : "Big Yikes", event == "unauthorized" ? "Sry Bestie" : event);
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
      showMessage(name + " is", "ONLINE");
    } else {
      String action = extractJsonString(response, "action");
      String domain = extractJsonString(response, "domain");
      String vibe = action == "IN" ? "Locked In" : "Ghosted";
      showMessage(name, domain + " " + vibe);
    }
  }

  Serial.println(response);

  delay(2500);
  showMessage("Tap In Bestie", "SRM Robocon");
}
