import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { createRequestSchema } from "@/lib/bazaar/validation";
import { getBazaarConfig } from "@/lib/bazaar/config";
import { isOverdue, getDaysOverdue } from "@/lib/bazaar/dates";
import { sendRequestSubmittedEmail } from "@/lib/bazaar/email";
import { BazaarRequest } from "@/lib/bazaar/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10)));
    const offset = (page - 1) * pageSize;

    const supabase = getBazaarDb();
    let query = supabase
      .from("bazaar_requests")
      .select("*, item:bazaar_items(id, name, image_url, location)", { count: "exact" })
      .eq("member_id", user.id);

    if (status) {
      query = query.eq("status", status);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    const requestsWithOverdue = ((data || []) as unknown as BazaarRequest[]).map((req) => {
      const overdue = isOverdue(req.status, req.expected_return_date);
      return {
        ...req,
        is_overdue: overdue,
        days_overdue: overdue ? getDaysOverdue(req.expected_return_date) : 0,
      };
    });

    return NextResponse.json({
      data: requestsWithOverdue,
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

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = createRequestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        "BAZAAR_VALIDATION",
        parsed.error.issues[0]?.message || "Validation failed",
        400,
        parsed.error.format()
      );
    }

    const itemsToCreate = parsed.data.items && parsed.data.items.length > 0
      ? parsed.data.items
      : [
          {
            item_id: parsed.data.item_id || null,
            custom_item_name: parsed.data.custom_item_name || null,
            quantity: parsed.data.quantity || 1,
          },
        ];

    const config = getBazaarConfig();
    const supabase = getBazaarDb();
    const createdIds: string[] = [];

    for (const itemEntry of itemsToCreate) {
      const { data: requestId, error } = await supabase.rpc("bazaar_create_request", {
        p_member_id: user.id,
        p_member_name: user.name,
        p_member_email: user.email || null,
        p_member_reg: user.regNumber || null,
        p_item: itemEntry.item_id || null,
        p_custom_item: itemEntry.custom_item_name || null,
        p_quantity: itemEntry.quantity,
        p_purpose: parsed.data.purpose,
        p_project: parsed.data.project_name || null,
        p_taking: parsed.data.taking_date,
        p_return: parsed.data.expected_return_date,
        p_usage_location: parsed.data.usage_location,
        p_location_details: parsed.data.location_details || null,
        p_max_active: config.maxActiveRequests,
        p_max_days: config.maxLoanDays,
      });

      if (error) {
        const mapped = mapDbError(error);
        return jsonError(mapped.code, mapped.message, mapped.status);
      }
      createdIds.push(requestId);
    }

    // Best-effort email notification to leads
    (async () => {
      try {
        for (const reqId of createdIds) {
          const { data: createdReq } = await supabase
            .from("bazaar_requests")
            .select("*, item:bazaar_items(id, name)")
            .eq("id", reqId)
            .single();
          if (createdReq) {
            await sendRequestSubmittedEmail(createdReq as unknown as BazaarRequest);
          }
        }
      } catch {
        // Silently caught in background task
      }
    })();

    return NextResponse.json({ id: createdIds[0], ids: createdIds, count: createdIds.length }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
