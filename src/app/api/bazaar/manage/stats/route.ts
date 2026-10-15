import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { todayIST, isOverdue, getDaysOverdue } from "@/lib/bazaar/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireViewer();
    const supabase = getBazaarDb();
    const today = todayIST();

    const [
      pendingRes,
      approvedRes,
      issuedRes,
      overdueRes,
      itemsRes,
      oldestPendingRes,
      overdueListRes,
    ] = await Promise.all([
      supabase.from("bazaar_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("bazaar_requests").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("bazaar_requests").select("id", { count: "exact", head: true }).eq("status", "issued"),
      supabase
        .from("bazaar_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "issued")
        .lt("expected_return_date", today),
      supabase
        .from("bazaar_items")
        .select("id, name, available_quantity, low_stock_threshold")
        .eq("is_active", true),
      supabase
        .from("bazaar_requests")
        .select("id, member_name, member_reg_number, quantity, purpose, taking_date, expected_return_date, created_at, item:bazaar_items(id, name, image_url, available_quantity)")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(5),
      supabase
        .from("bazaar_requests")
        .select("id, member_name, member_reg_number, quantity, taking_date, expected_return_date, item:bazaar_items(id, name, image_url)")
        .eq("status", "issued")
        .lt("expected_return_date", today)
        .order("expected_return_date", { ascending: true })
        .limit(5),
    ]);

    if (pendingRes.error) {
      const mapped = mapDbError(pendingRes.error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    const rawItems = (itemsRes.data || []) as unknown as any[];
    const lowStockCount = rawItems.filter(
      (item) => (item.low_stock_threshold || 0) > 0 && item.available_quantity <= item.low_stock_threshold
    ).length;

    const rawOverdue = (overdueListRes.data || []) as unknown as any[];
    const overdueWithDays = rawOverdue.map((r) => ({
      ...r,
      days_overdue: getDaysOverdue(r.expected_return_date),
    }));

    return NextResponse.json({
      stats: {
        pending: pendingRes.count || 0,
        awaiting_handover: approvedRes.count || 0,
        issued: issuedRes.count || 0,
        overdue: overdueRes.count || 0,
        low_stock: lowStockCount,
      },
      needs_attention: {
        oldest_pending: oldestPendingRes.data || [],
        top_overdue: overdueWithDays,
      },
    });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
