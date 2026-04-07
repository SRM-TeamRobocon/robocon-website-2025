// Server-side proxy — fetches attendance data from Google Apps Script
// Uses Node.js https module because fetch() doesn't handle Google's redirect chain properly
import { NextResponse } from "next/server";
import https from "https";
import { ATTENDANCE_CONFIG } from "@/app/attendance/attendance.config";

const APPS_SCRIPT_URL = ATTENDANCE_CONFIG.GOOGLE_SCRIPT_URL;

export const dynamic = "force-dynamic";

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const doRequest = (requestUrl: string, redirectCount: number) => {
      if (redirectCount > 10) {
        reject(new Error("Too many redirects"));
        return;
      }
      
      https.get(requestUrl, (res) => {
        // Handle redirects manually
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location, redirectCount + 1);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => resolve(data));
        res.on("error", reject);
      }).on("error", reject);
    };
    
    doRequest(url, 0);
  });
}

let cachedData = "";
let cacheTime = 0;

export async function GET() {
  try {
    // 30 Seconds In-Memory Cache to drastically speed up load times
    if (Date.now() - cacheTime < 30_000 && cachedData) {
      return new NextResponse(cachedData, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const urlObj = new URL(APPS_SCRIPT_URL);
    // Force the action=get parameter which the Apps script requires
    urlObj.searchParams.set("action", "get");
    // Append timestamp to bust Google's internal caches
    urlObj.searchParams.set("t", Date.now().toString());

    const body = await httpsGet(urlObj.toString());

    // Sanity check
    if (body.trim().startsWith("<!") || body.trim().startsWith("<HTML")) {
      return NextResponse.json(
        { error: "Apps Script returned HTML — re-deploy with Access: Anyone" },
        { status: 502 }
      );
    }

    cachedData = body;
    cacheTime = Date.now();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
