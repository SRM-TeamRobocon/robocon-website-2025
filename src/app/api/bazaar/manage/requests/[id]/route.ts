import { NextRequest, NextResponse } from "next/server";
import { requireViewer } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { isOverdue, getDaysOverdue } from "@/lib/bazaar/dates";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    await requireViewer();
    const { id } = await segmentData.params;

    const supabase = getBazaarDb();
    const [reqRes, activityRes] = await Promise.all([
      supabase
        .from("bazaar_requests")
        .select("*, item:bazaar_items(id, name, image_url, location, available_quantity, total_quantity, reserved_quantity, issued_quantity)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("bazaar_activity_log")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (reqRes.error) {
      const mapped = mapDbError(reqRes.error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    if (!reqRes.data) {
      return jsonError("BAZAAR_NOT_FOUND", "Request not found", 404);
    }

    const reqData = reqRes.data as unknown as any;
    const overdue = isOverdue(reqData.status, reqData.expected_return_date);
    const request = {
      ...reqData,
      is_overdue: overdue,
      days_overdue: overdue ? getDaysOverdue(reqData.expected_return_date) : 0,
    };

    return NextResponse.json({
      request,
      activity: activityRes.data || [],
    });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
