#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <esp_timer.h>
#include <atomic>
#include <time.h>
#include <sys/time.h>
#include "secrets.h"
#include "trust-root.h"
#include "tap-queue.h"

// Existing wiring: RFID SPI defaults + SS 21/RST 22; LCD SDA 33/SCL 32.
MFRC522 rfid(21, 22);
LiquidCrystal_I2C lcd(0x3F, 16, 2);
const char* tapURL = "https://www.srmteamrobocon.com/api/attendance/queued-tap";
const char* deviceId = "lobby-scanner-1"; // Give each scanner a unique ID.
const time_t CLOCK_READY = 1700000000;
Preferences storage;
TapQueue pending, proposed;
SemaphoreHandle_t queueMutex;
QueueHandle_t results;
std::atomic<bool> storageFailed{false};
std::atomic<int> networkCode{0};
uint64_t bootId;
uint64_t sequence = 0;
char latestId[33] = {};
String lastUid;
uint32_t lastScan = 0, screenSince = 0, badgeSince = 0;
bool resultVisible = false;

// HTTPClient decodes chunked responses into this bounded sink as well.
class ReplyBuffer : public Stream {
public:
  String text;
  size_t write(uint8_t value) override { return write(&value, 1); }
  size_t write(const uint8_t* data, size_t size) override {
    if (text.length() + size > 256) return 0;
    if (!text.concat((const char*)data, size)) return 0;
    return size;
  }
  int available() override { return 0; }
  int read() override { return -1; }
  int peek() override { return -1; }
  void flush() override {}
};

void showMessage(const String& top, const String& bottom) {
  lcd.setCursor(0, 0);
  lcd.print("                ");
  lcd.setCursor(0, 0);
  lcd.print(top.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print("                ");
  lcd.setCursor(0, 1);
  lcd.print(bottom.substring(0, 14));
  screenSince = millis();
  resultVisible = true;
}

void drawBadge() {
  lcd.setCursor(14, 1);
  if (WiFi.status() != WL_CONNECTED) lcd.print("--");
  else {
    int quality = constrain(2 * (WiFi.RSSI() + 100), 0, 99);
    if (quality < 10) lcd.print('0');
    lcd.print(quality);
  }
}

// Called only while holding queueMutex. NVS commits the blob before RAM changes.
bool commitQueue() {
  if (storage.putBytes("queue-v1", &proposed, sizeof(proposed)) != sizeof(proposed)) {
    storageFailed = true;
    return false;
  }
  pending = proposed;
  return true;
}

uint32_t pendingCount() {
  xSemaphoreTake(queueMutex, portMAX_DELAY);
  uint32_t count = pending.count;
  xSemaphoreGive(queueMutex);
  return count;
}

void showIdle() {
  uint32_t count = pendingCount();
  if (storageFailed) showMessage("Storage error", "Stop and repair");
  else if (networkCode == 401 || networkCode == 403) showMessage("Device key error", "Taps saved: " + String(count));
  else if (networkCode == 404) showMessage("Deploy API first", "Taps saved: " + String(count));
  else if (count) showMessage("Pending: " + String(count), WiFi.status() == WL_CONNECTED ? "Syncing..." : "Offline / saved");
  else showMessage("Scan card", WiFi.status() == WL_CONNECTED ? "Ready" : "Offline / ready");
  resultVisible = false;
  drawBadge();
}

bool saveTap(const String& uid) {
  StoredTap tap = {};
  tap.sequence = ++sequence;
  tap.boot = bootId;
  tap.uptimeUs = esp_timer_get_time();
  timeval now;
  gettimeofday(&now, nullptr);
  tap.epoch = now.tv_sec >= CLOCK_READY ? (int64_t)now.tv_sec * 1000 + now.tv_usec / 1000 : 0;
  snprintf(tap.id, sizeof(tap.id), "%08lx%08lx%08lx%08lx",
    (unsigned long)esp_random(), (unsigned long)esp_random(),
    (unsigned long)esp_random(), (unsigned long)esp_random());
  uid.toCharArray(tap.uid, sizeof(tap.uid));
  xSemaphoreTake(queueMutex, portMAX_DELAY);
  proposed = pending;
  bool full = proposed.count == 64;
  bool saved = !storageFailed && proposed.push(tap) && commitQueue();
  xSemaphoreGive(queueMutex);
  if (saved) {
    memcpy(latestId, tap.id, sizeof(latestId));
    showMessage("Saved locally", "Awaiting sync");
  } else showMessage(full ? "Queue full" : "Storage error", "NOT saved / retry");
  return saved;
}

// Protocol is four newline-separated fields, with the durable event ID echoed first.
// Never delete a queued tap based only on HTTP 200 or an unrecognised response.
bool parseReply(const String& response, const StoredTap& tap, UploadResult& result) {
  if (response.length() > 256) return false;
  int first = response.indexOf('\n');
  int second = response.indexOf('\n', first + 1);
  int third = response.indexOf('\n', second + 1);
  if (first != 32 || second < first || third < second || response.substring(0, first) != tap.id) return false;
  String event = response.substring(first + 1, second);
  String action = response.substring(second + 1, third);
  if (event != "tap" && event != "linked" && event != "unauthorized" && event != "review") return false;
  if (event == "tap" && action != "IN" && action != "OUT") return false;
  memcpy(result.id, tap.id, sizeof(result.id));
  event.toCharArray(result.event, sizeof(result.event));
  action.toCharArray(result.action, sizeof(result.action));
  response.substring(third + 1).toCharArray(result.name, sizeof(result.name));
  return true;
}

// The network owns a separate task: DNS, TLS and HTTP can wait without blocking RFID.
void uploadTask(void*) {
  WiFiClientSecure tls;
  tls.setCACert(ISRG_ROOT_X1);
  tls.setHandshakeTimeout(20);
  HTTPClient http;
  uint32_t reconnectAt = millis() + 30000, retryAt = millis(), backoff = 1000;
  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(100));
    uint32_t nowMs = millis();
    if (WiFi.status() != WL_CONNECTED) {
      if ((int32_t)(nowMs - reconnectAt) >= 0) {
        WiFi.reconnect();
        reconnectAt = nowMs + 30000;
      }
      continue;
    }
    time_t now = time(nullptr);
    if (now < CLOCK_READY || storageFailed || (int32_t)(nowMs - retryAt) < 0) continue;
    StoredTap tap = {};
    xSemaphoreTake(queueMutex, portMAX_DELAY);
    if (pending.count) {
      proposed = pending;
      // A tap before the first NTP sync can be dated while the same boot is alive.
      if (!proposed.taps[0].epoch && proposed.taps[0].boot == bootId) {
        timeval wall;
        gettimeofday(&wall, nullptr);
        proposed.taps[0].epoch = (int64_t)wall.tv_sec * 1000 + wall.tv_usec / 1000
          - (esp_timer_get_time() - proposed.taps[0].uptimeUs) / 1000;
        commitQueue();
      }
      tap = pending.taps[0];
    }
    xSemaphoreGive(queueMutex);
    if (!tap.id[0] || storageFailed) continue;
    if (!http.begin(tls, tapURL)) {
      retryAt = millis() + 10000;
      continue;
    }
    http.setReuse(true);
    http.setConnectTimeout(15000);
    http.setTimeout(20000);
    // No redirects: never forward a bearer token to another host.
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + DEVICE_SECRET);
    char body[256];
    snprintf(body, sizeof(body), "{\"eventId\":\"%s\",\"uid\":\"%s\",\"deviceId\":\"%s\",\"timestamp\":%lld}",
      tap.id, tap.uid, deviceId, (long long)tap.epoch);
    int code = http.POST((uint8_t*)body, strlen(body));
    networkCode = code;
    ReplyBuffer response;
    bool readOk = code == 200 && http.getSize() <= 256 && http.writeToStream(&response) >= 0;
    http.end();
    UploadResult result = {};
    if (readOk && parseReply(response.text, tap, result)) {
      xSemaphoreTake(queueMutex, portMAX_DELAY);
      proposed = pending;
      bool removed = proposed.pop(result.id) && commitQueue();
      xSemaphoreGive(queueMutex);
      if (removed) xQueueSend(results, &result, 0);
      backoff = 1000;
      retryAt = millis() + 100;
    } else {
      Serial.printf("upload failed: HTTP %d; tap retained\n", code);
      retryAt = millis() + backoff + (esp_random() % 500);
      backoff = min(backoff * 2, (uint32_t)60000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin(33, 32);
  lcd.init();
  lcd.backlight();
  SPI.begin();
  rfid.PCD_Init();
  queueMutex = xSemaphoreCreateMutex();
  results = xQueueCreate(8, sizeof(UploadResult));
  if (!queueMutex || !results) {
    showMessage("Startup failed", "Restart device");
    while (true) delay(1000);
  }
  bootId = ((uint64_t)esp_random() << 32) | esp_random();
  if (!storage.begin("attendance", false)) storageFailed = true;
  else if (storage.isKey("queue-v1")) {
    if (storage.getBytesLength("queue-v1") != sizeof(pending) ||
        storage.getBytes("queue-v1", &pending, sizeof(pending)) != sizeof(pending) || !pending.valid()) {
      storageFailed = true; // Preserve corrupt/unknown data for recovery; never erase it.
    }
  }
  if (!storageFailed && pending.count) sequence = pending.taps[pending.count - 1].sequence;
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  configTime(0, 0, "pool.ntp.org", "time.nist.gov", "time.google.com");
  if (xTaskCreate(uploadTask, "attendance-upload", 16384, nullptr, 1, nullptr) != pdPASS) storageFailed = true;
  showIdle();
}

void loop() {
  UploadResult result;
  while (xQueueReceive(results, &result, 0) == pdTRUE) {
    // An old upload must not replace the feedback for someone who just scanned.
    if (strcmp(result.id, latestId) != 0 && strcmp(result.event, "review") != 0) continue;
    if (!strcmp(result.event, "tap")) showMessage(result.name, String("Confirmed ") + result.action);
    else if (!strcmp(result.event, "linked")) showMessage(result.name, "Card linked");
    else if (!strcmp(result.event, "review")) showMessage("Needs review", "Saved on server");
    else showMessage("Unknown card", "Link on website");
    drawBadge();
  }
  if (resultVisible && millis() - screenSince >= 4000) showIdle();
  if (millis() - badgeSince >= 5000) {
    badgeSince = millis();
    if (!resultVisible) showIdle();
    else drawBadge();
  }
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    char uid[21] = {};
    for (byte i = 0; i < rfid.uid.size && i < 10; ++i) snprintf(uid + 2 * i, 3, "%02X", rfid.uid.uidByte[i]);
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    if (lastUid != uid || millis() - lastScan >= 3000) {
      if (saveTap(String(uid))) {
        lastUid = uid;
        lastScan = millis();
      }
      drawBadge();
    }
  }
  delay(5);
}
