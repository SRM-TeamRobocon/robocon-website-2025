import { NextRequest, NextResponse } from "next/server";
import { requireViewer, requireLead, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { createItemSchema } from "@/lib/bazaar/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireViewer();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim();
    const category = searchParams.get("category");
    const lowStock = searchParams.get("lowStock") === "1";
    const showInactive = searchParams.get("inactive") === "1";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10)));
    const offset = (page - 1) * pageSize;

    const supabase = getBazaarDb();
    let query = supabase
      .from("bazaar_items")
      .select("*, category:bazaar_categories(id, name)", { count: "exact" });

    if (!showInactive) {
      query = query.eq("is_active", true);
    }
    if (q) {
      query = query.ilike("name", `%${q}%`);
    }
    if (category) {
      query = query.eq("category_id", category);
    }

    query = query
      .order("name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    let items = (data || []) as unknown as any[];
    if (lowStock) {
      items = items.filter(
        (i) => (i.low_stock_threshold || 0) > 0 && i.available_quantity <= i.low_stock_threshold
      );
    }

    return NextResponse.json({
      data: items,
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
    const user = await requireLead();
    const body = await request.json();
    const parsed = createItemSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        "BAZAAR_VALIDATION",
        parsed.error.issues[0]?.message || "Validation failed",
        400,
        parsed.error.format()
      );
    }

    const {
      name,
      description,
      category_id,
      location,
      image_url,
      total_quantity,
      low_stock_threshold,
    } = parsed.data;

    const supabase = getBazaarDb();
    const { data, error } = await supabase
      .from("bazaar_items")
      .insert({
        name,
        description: description || null,
        category_id: category_id || null,
        location: location || null,
        image_url: image_url || null,
        total_quantity,
        low_stock_threshold: low_stock_threshold ?? 0,
        created_by: user.id,
      })
      .select("*, category:bazaar_categories(id, name)")
      .single();

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    // Write audit log
    await supabase.from("bazaar_activity_log").insert({
      item_id: data.id,
      actor: actorString(user),
      action: "item_created",
      detail: {
        name,
        total_quantity,
        low_stock_threshold,
      },
    });

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
