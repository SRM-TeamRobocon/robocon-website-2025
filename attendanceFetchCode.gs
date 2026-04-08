// ====================
// SRM ROBOCON ATTENDANCE — GOOGLE APPS SCRIPT
// ====================
// DEPLOY: Extensions -> Apps Script -> Deploy -> Web App
// Execute as: Me | Access: Anyone
//
// Fetch URL: <deploy-url>?action=get
// Tap URL:   <deploy-url>?name=X&uid=Y&status=Z

var CONFIG = {
  TZ: "Asia/Kolkata",
  MAX_SESSION_HOURS: 16,
  DUPLICATE_IN_HOURS: 6,
  DEFAULT_NAME_PREFIX: "Member",
  DEFAULT_DOMAIN: "GENERAL"
};

var MAX_SESSION_MS = CONFIG.MAX_SESSION_HOURS * 60 * 60 * 1000;
var DUPLICATE_IN_MS = CONFIG.DUPLICATE_IN_HOURS * 60 * 60 * 1000;

var STUDENTS = {
  "A9DC6F63": { name: "Anubhav", domain: "SPACED" },
  "493FEAB": { name: "Abraham", domain: "MCSOD" },
  "895D8654": { name: "Rayyah", domain: "SPACED" },
  "99ECB9D": { name: "K Manish", domain: "SAMBED" },
  "F9A537AC": { name: "Rijul", domain: "SAMBED" },
  "F968AB94": { name: "Syed Misbahul", domain: "MCSOD" },
  "F94A9894": { name: "Vrashni", domain: "SEISED" },
  "9EE14AB": { name: "Niranjana", domain: "SEISED" },
  "A918A994": { name: "Sangamithraa", domain: "SAMBED" },
  "29A6C09D": { name: "Shaziya", domain: "SEISED" },
  "9DE18AB": { name: "Deepa", domain: "MCSOD" },
  "79859A94": { name: "Shresth", domain: "SAMBED" },
  "A95D8654": { name: "Smriti Dubey", domain: "MCSOD" },
  "B9C62E6C": { name: "TEAM LEAD", domain: "TEAM" },
  "E9818E54": { name: "Ashwin", domain: "MCSOD" },
  "39999D94": { name: "Arshia Gupta", domain: "SPACED" },
  "89EA17AB": { name: "Krish Parekh", domain: "SPACED" },
  "4946AA94": { name: "Aman Chouhan", domain: "SPACED" },
  "E9ECA894": { name: "Adarsh Mittal", domain: "SPACED" },
  "49EAA994": { name: "Swastika", domain: "MCSOD" },
  "79A24AB": { name: "Soham", domain: "MCSOD" },
  "697713AB": { name: "Bhaskar", domain: "SEISED" },
  "29EBC39D": { name: "Karthik", domain: "SEISED" },
  "C98E23AB": { name: "Rajat", domain: "SPACED" },
  "29781BAB": { name: "Nitiraj", domain: "MCSOD" },
  "29908754": { name: "Nilesh", domain: "SEISED" },
  "E9689054": { name: "Mohamed Abdullah", domain: "SEISED" },
  "4929BD9D": { name: "Daksh", domain: "SPACED" },
  "29D35E61": { name: "Tanisha", domain: "SAMBED" },
  "D92E9994": { name: "Vineet", domain: "SEISED" },
  "D9CCBB9D": { name: "Keerthana", domain: "SAMBED" },
  "79F28654": { name: "Samparna", domain: "SAMBED" },
  "D94419AB": { name: "Bhargave", domain: "SEISED" },
  "8949D162": { name: "Dominic", domain: "SPACED" },
  "4920A594": { name: "Pranav", domain: "MCSOD" },
  "19979B94": { name: "Nimish", domain: "SAMBED" },
  "C975A294": { name: "Swarnava", domain: "SPACED" },
  "2965A994": { name: "Ananya", domain: "MCSOD" },
  "C9C89F94": { name: "Devdath", domain: "SEISED" },
  "B9C79594": { name: "Swapneel", domain: "SPACED" },
  "9118D54": { name: "Rohan", domain: "MCSOD" },
  "698F9D94": { name: "Mireya", domain: "SAMBED" },
  "298A194": { name: "Yashodhara", domain: "MCSOD" },
  "9548E54": { name: "Nithya Guru", domain: "SAMBED" },
  "59F2A794": { name: "Sana", domain: "SAMBED" },
  "99A06661": { name: "Agamjot Kaur", domain: "SEISED" }
};

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var params = e && e.parameter ? e.parameter : {};
  var now = new Date();

  autoCheckoutExpiredSessions(sheet, now);

  if (params.action === "get") {
    var data = sheet.getDataRange().getDisplayValues();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var uid = normalizeUid(params.uid);
  if (!uid) {
    return ContentService.createTextOutput("Missing uid");
  }

  var student = STUDENTS[uid] || null;
  var resolvedName = student ? student.name : (params.name || buildFallbackName(uid));
  var resolvedDomain = student ? student.domain : CONFIG.DEFAULT_DOMAIN;
  var explicitStatus = normalizeStatus(params.status);

  var stateMap = buildOpenSessionState(sheet);
  var currentlyOpen = stateMap[uid] || null;
  var nextStatus = explicitStatus;
  if (!nextStatus) {
    nextStatus = currentlyOpen ? "OUT" : "IN";
  }

  // If another IN comes while already IN, auto-close previous with fixed 6h.
  if (nextStatus === "IN" && currentlyOpen) {
    var forcedOutAt = new Date(currentlyOpen.lastInTs + DUPLICATE_IN_MS);
    appendAttendanceRow(
      sheet,
      currentlyOpen.name || resolvedName,
      uid,
      forcedOutAt,
      "OUT",
      currentlyOpen.domain || resolvedDomain
    );
  }

  // If OUT arrives without open IN, convert to IN (self-heal bad status sequence).
  if (nextStatus === "OUT" && !currentlyOpen) {
    nextStatus = "IN";
  }

  appendAttendanceRow(sheet, resolvedName, uid, now, nextStatus, resolvedDomain);
  return ContentService.createTextOutput("OK");
}

function appendAttendanceRow(sheet, name, uid, whenDate, status, domain) {
  var rowDate = Utilities.formatDate(whenDate, CONFIG.TZ, "dd/MM/yyyy");
  var rowTime = Utilities.formatDate(whenDate, CONFIG.TZ, "HH:mm:ss");
  sheet.appendRow([name, uid, rowDate, rowTime, status, domain]);
}

function buildOpenSessionState(sheet) {
  var values = sheet.getDataRange().getValues();
  var stateMap = {};
  if (values.length < 2) return stateMap;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var uid = normalizeUid(row[1]);
    if (!uid) continue;

    var ts = parseRowTimestamp(row[2], row[3]);
    if (isNaN(ts)) continue;

    var action = normalizeStatus(row[4]);
    if (!action) {
      action = stateMap[uid] ? "OUT" : "IN";
    }

    if (action === "IN") {
      stateMap[uid] = {
        name: String(row[0] || (STUDENTS[uid] ? STUDENTS[uid].name : buildFallbackName(uid))),
        domain: String(row[5] || (STUDENTS[uid] ? STUDENTS[uid].domain : CONFIG.DEFAULT_DOMAIN)),
        lastInTs: ts
      };
    } else {
      delete stateMap[uid];
    }
  }

  return stateMap;
}

function autoCheckoutExpiredSessions(sheet, now) {
  var stateMap = buildOpenSessionState(sheet);
  var nowTs = now.getTime();
  for (var uid in stateMap) {
    if (!stateMap.hasOwnProperty(uid)) continue;
    var entry = stateMap[uid];
    if (nowTs - entry.lastInTs > MAX_SESSION_MS) {
      var outAt = new Date(entry.lastInTs + MAX_SESSION_MS);
      appendAttendanceRow(
        sheet,
        entry.name || (STUDENTS[uid] ? STUDENTS[uid].name : buildFallbackName(uid)),
        uid,
        outAt,
        "OUT",
        entry.domain || (STUDENTS[uid] ? STUDENTS[uid].domain : CONFIG.DEFAULT_DOMAIN)
      );
    }
  }
}

function normalizeUid(uid) {
  return String(uid || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeStatus(status) {
  var s = String(status || "").toUpperCase().trim();
  if (s === "IN" || s === "OUT") return s;
  return "";
}

function parseRowTimestamp(dateCell, timeCell) {
  if (dateCell instanceof Date && !isNaN(dateCell.getTime())) {
    return dateCell.getTime();
  }

  var dateStr = String(dateCell || "").trim();
  var timeStr = String(timeCell || "").trim().replace(/\./g, ":");
  if (!dateStr || !timeStr) return NaN;

  var parts = dateStr.split("/");
  if (parts.length !== 3) return NaN;

  var dd = parts[0];
  var mm = parts[1];
  var yyyy = parts[2];
  var iso = yyyy + "-" + pad2(mm) + "-" + pad2(dd) + "T" + timeStr;
  var d = new Date(iso);
  return d.getTime();
}

function pad2(v) {
  var s = String(v);
  return s.length >= 2 ? s : "0" + s;
}

function buildFallbackName(uid) {
  var last4 = String(uid || "").slice(-4);
  if (!last4) last4 = "0000";
  return CONFIG.DEFAULT_NAME_PREFIX + " " + last4;
}
