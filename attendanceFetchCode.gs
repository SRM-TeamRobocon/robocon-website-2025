// ====================
// SRM ROBOCON ATTENDANCE — GOOGLE APPS SCRIPT
// ====================
// DEPLOY: Extensions -> Apps Script -> Deploy -> Web App
// Execute as: Me | Access: Anyone
//
// Fetch URL: <deploy-url>?action=get
// Tap URL:   <deploy-url>?name=X&uid=Y&status=Z

var TIME_ZONE = "Asia/Kolkata";
var FIXED_SESSION_MS = 4 * 60 * 60 * 1000;
var MAX_VALID_SESSION_MS = 15 * 60 * 60 * 1000;
var DEFAULT_NAME_PREFIX = "Member";
var DEFAULT_DOMAIN = "GENERAL";

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
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var params = e && e.parameter ? e.parameter : {};
    var now = new Date();

    autoCheckoutAtMidnight(sheet, now);

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
    var resolvedDomain = student ? student.domain : DEFAULT_DOMAIN;
    var explicitStatus = normalizeStatus(params.status);

    var stateMap = buildOpenSessionState(sheet);
    var currentlyOpen = stateMap[uid] || null;
    var nextStatus = explicitStatus;
    if (!nextStatus) {
      nextStatus = currentlyOpen ? "OUT" : "IN";
    }

    // If another IN comes while already IN, auto-close previous with fixed 4h.
    if (nextStatus === "IN" && currentlyOpen) {
      // Write the synthetic OUT just before the new IN so sequence is IN -> OUT -> IN.
      var forcedOutAt = new Date(now.getTime() - 1000);
      appendAttendanceRow(
        sheet,
        currentlyOpen.name || resolvedName,
        uid,
        forcedOutAt,
        "OUT",
        currentlyOpen.domain || resolvedDomain,
        "AUTO_FIX_DUP_IN_4H"
      );
    }

    // If OUT arrives without open IN, backfill an assumed IN 4h earlier.
    if (nextStatus === "OUT" && !currentlyOpen) {
      var assumedInAt = new Date(now.getTime() - FIXED_SESSION_MS);
      appendAttendanceRow(
        sheet,
        resolvedName,
        uid,
        assumedInAt,
        "IN",
        resolvedDomain,
        "AUTO_BACKFILL_IN_4H"
      );
    }

    var outputAt = now;
    var outputReason = "";
    if (nextStatus === "OUT" && currentlyOpen) {
      outputReason = resolveOutReason(currentlyOpen.lastInTs, now.getTime());
    } else if (nextStatus === "OUT" && !currentlyOpen) {
      outputReason = "AUTO_FIX_MISSING_IN_4H";
    }

    appendAttendanceRow(sheet, resolvedName, uid, outputAt, nextStatus, resolvedDomain, outputReason);
    return ContentService.createTextOutput("OK");
  } finally {
    lock.releaseLock();
  }
}

function appendAttendanceRow(sheet, name, uid, whenDate, status, domain, reason) {
  var rowDate = Utilities.formatDate(whenDate, TIME_ZONE, "dd/MM/yyyy");
  var rowTime = Utilities.formatDate(whenDate, TIME_ZONE, "HH:mm:ss");
  sheet.appendRow([name, uid, rowDate, rowTime, status, domain, reason || ""]);
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
        domain: String(row[5] || (STUDENTS[uid] ? STUDENTS[uid].domain : DEFAULT_DOMAIN)),
        lastInTs: ts
      };
    } else {
      delete stateMap[uid];
    }
  }

  return stateMap;
}

function autoCheckoutAtMidnight(sheet, now) {
  var stateMap = buildOpenSessionState(sheet);
  var nowTs = now.getTime();
  for (var uid in stateMap) {
    if (!stateMap.hasOwnProperty(uid)) continue;
    var entry = stateMap[uid];
    var outAt = getNextMidnight(entry.lastInTs);
    if (nowTs >= outAt.getTime()) {
      var outReason = resolveOutReason(entry.lastInTs, outAt.getTime());
      appendAttendanceRow(
        sheet,
        entry.name || (STUDENTS[uid] ? STUDENTS[uid].name : buildFallbackName(uid)),
        uid,
        outAt,
        "OUT",
        entry.domain || (STUDENTS[uid] ? STUDENTS[uid].domain : DEFAULT_DOMAIN),
        outReason || "AUTO_OUT_MIDNIGHT"
      );
    }
  }
}

// Scheduled trigger entrypoint (runs without page open/request).
function runAutoCheckout() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    autoCheckoutAtMidnight(sheet, new Date());
  } finally {
    lock.releaseLock();
  }
}

// One-time repair to add missing auto-fix rows for old bad sequences.
// Safe to run multiple times; it skips fixes that already exist.
function repairAttendanceHistory() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) return;

    var nowTs = new Date().getTime();
    var events = [];
    var existingFixKeys = {};

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var uid = normalizeUid(row[1]);
      if (!uid) continue;

      var ts = parseRowTimestamp(row[2], row[3]);
      if (isNaN(ts)) continue;

      var reason = String(row[6] || "").toUpperCase().trim();
      var action = normalizeStatus(row[4]);
      var name = String(row[0] || (STUDENTS[uid] ? STUDENTS[uid].name : buildFallbackName(uid)));
      var domain = String(row[5] || (STUDENTS[uid] ? STUDENTS[uid].domain : DEFAULT_DOMAIN));

      events.push({
        uid: uid,
        name: name,
        domain: domain,
        ts: ts,
        action: action,
        reason: reason,
        idx: i
      });

      if (reason) {
        existingFixKeys[uid + "|" + action + "|" + ts + "|" + reason] = true;
      }
    }

    events.sort(function(a, b) {
      if (a.ts !== b.ts) return a.ts - b.ts;
      return a.idx - b.idx;
    });

    var openMap = {};
    var rowsToAppend = [];

    for (var j = 0; j < events.length; j++) {
      var ev = events[j];
      var currentAction = ev.action;
      if (!currentAction) {
        currentAction = openMap[ev.uid] ? "OUT" : "IN";
      }

      if (currentAction === "IN") {
        if (openMap[ev.uid]) {
          var fixTs = ev.ts - 1000;
          var dupReason = "AUTO_FIX_DUP_IN_4H";
          var dupKey = ev.uid + "|OUT|" + fixTs + "|" + dupReason;
          if (!existingFixKeys[dupKey]) {
            rowsToAppend.push(buildRowForTimestamp(openMap[ev.uid].name, ev.uid, fixTs, "OUT", openMap[ev.uid].domain, dupReason));
            existingFixKeys[dupKey] = true;
          }
        }

        openMap[ev.uid] = {
          name: ev.name,
          domain: ev.domain,
          lastInTs: ev.ts
        };
      } else {
        if (!openMap[ev.uid]) {
          var inTs = ev.ts - FIXED_SESSION_MS - 1000;
          var backfillReason = "AUTO_BACKFILL_IN_4H";
          var backfillKey = ev.uid + "|IN|" + inTs + "|" + backfillReason;
          if (!existingFixKeys[backfillKey]) {
            rowsToAppend.push(buildRowForTimestamp(ev.name, ev.uid, inTs, "IN", ev.domain, backfillReason));
            existingFixKeys[backfillKey] = true;
          }
        } else {
          delete openMap[ev.uid];
        }
      }
    }

    for (var openUid in openMap) {
      if (!openMap.hasOwnProperty(openUid)) continue;
      var openEntry = openMap[openUid];
      var midnightOut = getNextMidnight(openEntry.lastInTs).getTime();
      if (midnightOut <= nowTs) {
        var outReason = resolveOutReason(openEntry.lastInTs, midnightOut) || "AUTO_OUT_MIDNIGHT";
        var outKey = openUid + "|OUT|" + midnightOut + "|" + outReason;
        if (!existingFixKeys[outKey]) {
          rowsToAppend.push(buildRowForTimestamp(openEntry.name, openUid, midnightOut, "OUT", openEntry.domain, outReason));
          existingFixKeys[outKey] = true;
        }
      }
    }

    if (rowsToAppend.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, 7).setValues(rowsToAppend);
    }
  } finally {
    lock.releaseLock();
  }
}

// Run once from Apps Script editor to install periodic auto-checkout.
function installAutoCheckoutTriggers() {
  var handler = "runAutoCheckout";
  var triggers = ScriptApp.getProjectTriggers();

  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyMinutes(15)
    .create();
}

function getNextMidnight(ts) {
  var oneDayMs = 24 * 60 * 60 * 1000;
  var nextDateKey = Utilities.formatDate(new Date(ts + oneDayMs), TIME_ZONE, "yyyy-MM-dd");
  return new Date(nextDateKey + "T00:00:00+05:30");
}

function resolveOutReason(inTs, outTs) {
  if (outTs - inTs > MAX_VALID_SESSION_MS) {
    return "AUTO_FIX_OVER_15H_4H";
  }
  return "";
}

function buildRowForTimestamp(name, uid, ts, status, domain, reason) {
  var d = new Date(ts);
  var rowDate = Utilities.formatDate(d, TIME_ZONE, "dd/MM/yyyy");
  var rowTime = Utilities.formatDate(d, TIME_ZONE, "HH:mm:ss");
  return [name, uid, rowDate, rowTime, status, domain || DEFAULT_DOMAIN, reason || ""];
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
  return DEFAULT_NAME_PREFIX + " " + last4;
}
