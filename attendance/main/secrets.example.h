// Copy this file to secrets.h (gitignored — never commit that one) and fill in real
// values. main.ino #includes "secrets.h", not this file.
//
// THIS FILE IS COMMITTED TO A PUBLIC REPO. Leave the placeholders as placeholders —
// anything typed in here gets published.
#pragma once
#include <stddef.h>

// Plain WPA2-Personal networks. Add or remove entries as needed.
struct WiFiNetwork { const char* ssid; const char* password; };
const WiFiNetwork WIFI_NETWORKS[] = {
  {"YOUR_FIRST_WIFI_SSID", "YOUR_FIRST_WIFI_PASSWORD"},
  {"YOUR_SECOND_WIFI_SSID", "YOUR_SECOND_WIFI_PASSWORD"},
};
constexpr size_t WIFI_NETWORK_COUNT = sizeof(WIFI_NETWORKS) / sizeof(WIFI_NETWORKS[0]);

// Must match ATTENDANCE_DEVICE_SECRET in the server's environment variables exactly.
const char* DEVICE_SECRET = "GENERATE_A_LONG_RANDOM_STRING";
