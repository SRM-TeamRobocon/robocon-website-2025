// ====================
// SRM ROBOCON ATTENDANCE — GOOGLE APPS SCRIPT
// ====================
// This script handles TWO things:
// 1. LOGGING attendance taps from ESP32/RFID (existing)
// 2. SERVING data as JSON to the dashboard (new)
//
// DEPLOY: Extensions → Apps Script → Deploy → Web App
//   Execute as: Me | Access: Anyone
//
// DASHBOARD URL: <your-deploy-url>?action=get
// ESP32 URL:     <your-deploy-url>?name=X&uid=Y&status=Z

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // ---- DATA FETCH MODE ----
  // If ?action=get is passed, return ALL rows as JSON
  if (e.parameter.action === 'get') {
    var data = sheet.getDataRange().getDisplayValues();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ---- ATTENDANCE LOG MODE ----
  // ESP32/RFID sends: ?name=X&uid=Y&status=Z
  var name = e.parameter.name;
  var uid = e.parameter.uid;
  var status = e.parameter.status;

  var now = new Date();
  var date = Utilities.formatDate(now, "Asia/Kolkata", "dd/MM/yyyy");
  var time = Utilities.formatDate(now, "Asia/Kolkata", "HH:mm:ss");

  sheet.appendRow([name, uid, date, time, status]);

  return ContentService.createTextOutput("OK");
}
