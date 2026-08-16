// Copy this file to secrets.h (gitignored — never commit that one) and fill in real
// values. main.ino #includes "secrets.h", not this file.
#pragma once

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Must match ATTENDANCE_DEVICE_SECRET in the server's environment variables exactly.
const char* DEVICE_SECRET = "GENERATE_A_LONG_RANDOM_STRING";
