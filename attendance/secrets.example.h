// Copy this file to secrets.h (gitignored — never commit that one) and fill in real
// values. main.ino #includes "secrets.h", not this file.
//
// THIS FILE IS COMMITTED TO A PUBLIC REPO. Leave the placeholders as placeholders —
// anything typed in here gets published.
#pragma once

// Plain WPA2-Personal network: one SSID, one shared password.
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Must match ATTENDANCE_DEVICE_SECRET in the server's environment variables exactly.
const char* DEVICE_SECRET = "GENERATE_A_LONG_RANDOM_STRING";
