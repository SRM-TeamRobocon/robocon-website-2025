import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await segmentData.params;

    const supabase = getBazaarDb();
    const { data, error } = await supabase
      .from("bazaar_items")
      .select("id, name, description, category_id, location, image_url, available_quantity, category:bazaar_categories(id, name)")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    if (!data) {
      return jsonError("BAZAAR_ITEM_NOT_FOUND", "Item not found or inactive", 404);
    }

    return NextResponse.json({ item: data });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
