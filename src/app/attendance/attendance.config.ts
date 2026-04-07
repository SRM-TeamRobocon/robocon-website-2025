export const ATTENDANCE_CONFIG = {
  // ─────────────────────────────────────────────────────────────
  // 🔗 GOOGLE SHEETS API URL
  // ─────────────────────────────────────────────────────────────
  // Paste your published Google Apps Script Web App URL here. 
  // Remember: When you publish your script, it MUST be set to 
  // "Who has access: Anyone" or the dashboard will fail to fetch data.
  GOOGLE_SCRIPT_URL: process.env.GOOGLE_SCRIPT_URL || "",


  // ─────────────────────────────────────────────────────────────
  // ⏱️ SESSION LIMITS (AUTO-CHECKOUT)
  // ─────────────────────────────────────────────────────────────
  // If someone forgets to scan out, their session will stay "IN LAB" forever.
  // MAX_SESSION_HOURS: If a session goes over this many hours, it triggers auto-checkout.
  MAX_SESSION_HOURS: 16,
  
  // CAPPED_SESSION_HOURS: What the punished session should be reduced to (e.g., 12 hours)
  CAPPED_SESSION_HOURS: 12,
};
