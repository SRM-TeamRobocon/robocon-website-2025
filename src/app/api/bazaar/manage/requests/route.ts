import { NextRequest, NextResponse } from "next/server";
import { requireViewer } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { todayIST, isOverdue, getDaysOverdue } from "@/lib/bazaar/dates";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireViewer();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const overdueOnly = searchParams.get("overdue") === "1";
    const memberId = searchParams.get("member");
    const itemId = searchParams.get("item");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const q = searchParams.get("q")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10)));
    const offset = (page - 1) * pageSize;

    const today = todayIST();
    const supabase = getBazaarDb();
    let query = supabase
      .from("bazaar_requests")
      .select("*, item:bazaar_items(id, name, image_url, location, available_quantity)", {
        count: "exact",
      });

    if (overdueOnly) {
      query = query.eq("status", "issued").lt("expected_return_date", today);
    } else if (status) {
      query = query.eq("status", status);
    }

    if (memberId) {
      query = query.eq("member_id", memberId);
    }
    if (itemId) {
      query = query.eq("item_id", itemId);
    }
    if (fromDate) {
      query = query.gte("taking_date", fromDate);
    }
    if (toDate) {
      query = query.lte("taking_date", toDate);
    }
    if (q) {
      // Search across member_name or member_reg_number
      query = query.or(`member_name.ilike.%${q}%,member_reg_number.ilike.%${q}%`);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    const processed = ((data || []) as unknown as any[]).map((req) => {
      const overdue = isOverdue(req.status, req.expected_return_date);
      return {
        ...req,
        is_overdue: overdue,
        days_overdue: overdue ? getDaysOverdue(req.expected_return_date) : 0,
      };
    });

    return NextResponse.json({
      data: processed,
      page,
      pageSize,
      total: count || 0,
    });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
