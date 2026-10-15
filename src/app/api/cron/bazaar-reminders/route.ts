import { NextResponse } from "next/server";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { todayIST, daysBetween, getDaysOverdue } from "@/lib/bazaar/dates";
import {
  sendDueReminderEmail,
  sendOverdueReminderEmail,
  sendOverdueDigestEmail,
} from "@/lib/bazaar/email";
import { BazaarRequest } from "@/lib/bazaar/types";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret && process.env.NODE_ENV === "production") {
    return false;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${expectedSecret || "local-dev"}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "BAZAAR_UNAUTHENTICATED", message: "Unauthorized cron request" } },
      { status: 401 }
    );
  }

  const today = todayIST();
  const supabase = getBazaarDb();
  const nowIso = new Date().toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Fetch active issued requests
  const { data: issuedRequests, error } = await supabase
    .from("bazaar_requests")
    .select("*, item:bazaar_items(id, name)")
    .eq("status", "issued");

  if (error) {
    console.error("[Bazaar Cron] Failed to fetch issued requests:", error);
    return NextResponse.json(
      { error: { code: "BAZAAR_INTERNAL", message: "Database query failed" } },
      { status: 500 }
    );
  }

  const requests = (issuedRequests || []) as unknown as BazaarRequest[];
  let remindedDueTomorrow = 0;
  let remindedOverdue = 0;
  const overdueForDigest: BazaarRequest[] = [];

  for (const req of requests) {
    const returnDate = req.expected_return_date;

    // Check if due tomorrow (diff === 1)
    const daysUntilDue = daysBetween(today, returnDate);
    if (daysUntilDue === 1) {
      // Send reminder if not reminded in the last 24h
      if (!req.last_reminder_at || req.last_reminder_at < twentyFourHoursAgo) {
        await sendDueReminderEmail(req);
        await supabase
          .from("bazaar_requests")
          .update({ last_reminder_at: nowIso })
          .eq("id", req.id);
        remindedDueTomorrow++;
      }
    }

    // Check if overdue (expected_return_date < today)
    if (returnDate < today) {
      const overdueDays = getDaysOverdue(returnDate);
      overdueForDigest.push({
        ...req,
        is_overdue: true,
        days_overdue: overdueDays,
      });

      // Send member reminder if not reminded in the last 24 hours
      if (!req.last_reminder_at || req.last_reminder_at < twentyFourHoursAgo) {
        await sendOverdueReminderEmail(req, overdueDays);
        await supabase
          .from("bazaar_requests")
          .update({ last_reminder_at: nowIso })
          .eq("id", req.id);
        remindedOverdue++;
      }
    }
  }

  // Send digest to leads if there are overdue items
  let leadsDigestSent = false;
  if (overdueForDigest.length > 0) {
    await sendOverdueDigestEmail(overdueForDigest);
    leadsDigestSent = true;
  }

  return NextResponse.json({
    ok: true,
    reminded_due_tomorrow: remindedDueTomorrow,
    reminded_overdue: remindedOverdue,
    overdue_count: overdueForDigest.length,
    leads_digest_sent: leadsDigestSent,
    timestamp: nowIso,
  });
}
