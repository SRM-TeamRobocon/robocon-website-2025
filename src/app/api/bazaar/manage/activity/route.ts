import { NextRequest, NextResponse } from "next/server";
import { requireViewer } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireViewer();
    const { searchParams } = new URL(request.url);

    const requestId = searchParams.get("request_id");
    const itemId = searchParams.get("item_id");
    const action = searchParams.get("action");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));
    const offset = (page - 1) * pageSize;

    const supabase = getBazaarDb();
    let query = supabase
      .from("bazaar_activity_log")
      .select("*, item:bazaar_items(id, name), request:bazaar_requests(id, member_name, quantity)", {
        count: "exact",
      });

    if (requestId) {
      query = query.eq("request_id", requestId);
    }
    if (itemId) {
      query = query.eq("item_id", itemId);
    }
    if (action) {
      query = query.eq("action", action);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    return NextResponse.json({
      data: data || [],
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
