// Copy this file to secrets.h (gitignored — never commit that one) and fill in real
// values. main.ino #includes "secrets.h", not this file.
//
// THIS FILE IS COMMITTED TO A PUBLIC REPO. Leave the placeholders as placeholders —
// anything typed in here gets published, a netid included.
#pragma once

// ── Campus network: association ──────────────────────────────────────────────
// Leave CAMPUS_PASSWORD empty for an open SSID (the usual case when there's a
// browser login page instead). Set it if there's a pre-shared key.
const char* CAMPUS_SSID = "SRMIST";
const char* CAMPUS_PASSWORD = "";

// ── Campus network: WPA2-Enterprise (optional) ───────────────────────────────
// Used only if EAP_USERNAME is non-empty. Leave all three blank when the campus
// SSID is open with a captive portal rather than 802.1X.
const char* EAP_IDENTITY = "";  // outer identity; usually the same as the username
const char* EAP_USERNAME = "";
const char* EAP_PASSWORD = "";

// ── Captive portal (Sophos / Cyberoam) ───────────────────────────────────────
// The browser login page the scanner has to fill in for itself. Set PORTAL_HOST to
// "" if the network has no portal. To find the host, connect a laptop to the same
// SSID and run:
//     curl -v http://neverssl.com
// then read the IP out of the `Location:` redirect header.
const char* PORTAL_HOST = "";  // e.g. "10.0.0.1"
const int PORTAL_PORT = 8090;
const char* PORTAL_USERNAME = "";
const char* PORTAL_PASSWORD = "";

// Must match ATTENDANCE_DEVICE_SECRET in the server's environment variables exactly.
const char* DEVICE_SECRET = "GENERATE_A_LONG_RANDOM_STRING";
