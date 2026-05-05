import { NextResponse } from "next/server";
import { google } from "googleapis";

// It's recommended to call this via a cron job (e.g. Vercel Cron, GitHub Actions)
// It will look for IN sessions > 24 hours and append an OUT row.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || "local-dev"}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!sheetId || !clientEmail || !privateKey) {
      return NextResponse.json(
        { error: "Missing Google Sheets API credentials in environment variables" },
        { status: 500 }
      );
    }

    // 1. Fetch current logs to find open sessions > 24h
    // We fetch from our own GET endpoint to reuse the exact same parsing logic
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/attendance`);
    if (!res.ok) {
      throw new Error("Failed to fetch current attendance data");
    }
    const data = await res.json();
    
    // We need to parse the data to find who is "IN"
    // To avoid duplicating logic here, we'll just do a lightweight pass over the rows.
    // The JSON from /api/attendance is exactly the 2D array from Apps Script.
    // Row format: [Name, UID, Date, Time, Action, Domain, Reason]

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return NextResponse.json({ message: "No attendance data found" });
    }

    const userMap = new Map<string, { lastTapTs: number, name: string, domain: string, action: string }>();

    for (let i = 1; i < rows.length; i++) { // skip header
      const row = rows[i];
      if (!row || row.length < 4) continue;
      
      const name = String(row[0] || "").trim();
      const uid = String(row[1] || "").trim().toUpperCase();
      const rawDate = String(row[2] || "").trim();
      const rawTime = String(row[3] || "").trim();
      const action = String(row[4] || "").trim().toUpperCase();
      const domain = String(row[5] || "").trim();

      if (!uid) continue;

      // Parse DD/MM/YYYY
      const parts = rawDate.split("/");
      if (parts.length !== 3) continue;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);

      // Parse HH:MM:SS
      const timeMatch = rawTime.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/);
      let hours = 0, minutes = 0, seconds = 0;
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        seconds = parseInt(timeMatch[3], 10);
      }

      const d = new Date(year, month, day, hours, minutes, seconds);
      const ts = d.getTime();

      if (isNaN(ts)) continue;

      if (!userMap.has(uid) || ts > userMap.get(uid)!.lastTapTs) {
        userMap.set(uid, { lastTapTs: ts, name, domain, action });
      }
    }

    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const usersToCheckout: Array<any[]> = [];

    for (const [uid, state] of Array.from(userMap.entries())) {
      if (state.action === "IN") {
        const duration = now - state.lastTapTs;
        if (duration > twentyFourHoursMs) {
          // Needs auto checkout
          const d = new Date();
          const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
          const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
          
          usersToCheckout.push([
            state.name,
            uid,
            dateStr,
            timeStr,
            "OUT",
            state.domain,
            "AUTO 24H CHECKOUT"
          ]);
        }
      }
    }

    if (usersToCheckout.length === 0) {
      return NextResponse.json({ message: "No stale sessions found." });
    }

    // 2. Append to Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1", // Will append to the first available row in Sheet1
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: usersToCheckout,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Auto-checked out ${usersToCheckout.length} users.`,
      users: usersToCheckout.map(u => u[0])
    });

  } catch (error: any) {
    console.error("Auto-checkout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
