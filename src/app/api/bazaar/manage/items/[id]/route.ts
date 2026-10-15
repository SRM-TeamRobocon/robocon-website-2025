import { NextRequest, NextResponse } from "next/server";
import { requireViewer, requireLead, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { updateItemSchema } from "@/lib/bazaar/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    await requireViewer();
    const { id } = await segmentData.params;

    const supabase = getBazaarDb();
    const [itemRes, activityRes] = await Promise.all([
      supabase
        .from("bazaar_items")
        .select("*, category:bazaar_categories(id, name)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("bazaar_activity_log")
        .select("*")
        .eq("item_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (itemRes.error) {
      const mapped = mapDbError(itemRes.error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    if (!itemRes.data) {
      return jsonError("BAZAAR_ITEM_NOT_FOUND", "Item not found", 404);
    }

    return NextResponse.json({
      item: itemRes.data,
      recent_activity: activityRes.data || [],
    });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireLead();
    const { id } = await segmentData.params;
    const body = await request.json();

    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        "BAZAAR_VALIDATION",
        parsed.error.issues[0]?.message || "Validation failed",
        400,
        parsed.error.format()
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description || null;
    if (parsed.data.category_id !== undefined) updates.category_id = parsed.data.category_id || null;
    if (parsed.data.location !== undefined) updates.location = parsed.data.location || null;
    if (parsed.data.image_url !== undefined) updates.image_url = parsed.data.image_url || null;
    if (parsed.data.low_stock_threshold !== undefined) updates.low_stock_threshold = parsed.data.low_stock_threshold;
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;

    const supabase = getBazaarDb();
    const { data, error } = await supabase
      .from("bazaar_items")
      .update(updates)
      .eq("id", id)
      .select("*, category:bazaar_categories(id, name)")
      .maybeSingle();

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    if (!data) {
      return jsonError("BAZAAR_ITEM_NOT_FOUND", "Item not found", 404);
    }

    await supabase.from("bazaar_activity_log").insert({
      item_id: id,
      actor: actorString(user),
      action: "item_updated",
      detail: updates,
    });

    return NextResponse.json({ item: data });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireLead();
    const { id } = await segmentData.params;

    const supabase = getBazaarDb();

    // Check if item has request history
    const { count, error: countErr } = await supabase
      .from("bazaar_requests")
      .select("id", { count: "exact", head: true })
      .eq("item_id", id);

    if (countErr) {
      const mapped = mapDbError(countErr);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    if (count && count > 0) {
      // Soft-delete to preserve history
      const { error: softErr } = await supabase
        .from("bazaar_items")
        .update({ is_active: false })
        .eq("id", id);

      if (softErr) {
        const mapped = mapDbError(softErr);
        return jsonError(mapped.code, mapped.message, mapped.status);
      }

      await supabase.from("bazaar_activity_log").insert({
        item_id: id,
        actor: actorString(user),
        action: "item_deactivated",
        detail: { reason: "Soft-deleted due to existing request history" },
      });

      return NextResponse.json({
        ok: true,
        message: "Item has request history; it has been deactivated rather than deleted",
        deactivated: true,
      });
    }

    // Zero requests: perform hard delete
    const { error: deleteErr } = await supabase
      .from("bazaar_items")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      const mapped = mapDbError(deleteErr);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    return NextResponse.json({ ok: true, deleted: true });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
