import { NextRequest, NextResponse } from "next/server";
import { requireLead, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { stockAdjustSchema } from "@/lib/bazaar/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireLead();
    const { id } = await segmentData.params;
    const body = await request.json();

    const parsed = stockAdjustSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        "BAZAAR_VALIDATION",
        parsed.error.issues[0]?.message || "Validation failed",
        400,
        parsed.error.format()
      );
    }

    const { total_delta, damaged_delta, note } = parsed.data;

    const supabase = getBazaarDb();
    const { error } = await supabase.rpc("bazaar_adjust_stock", {
      p_item: id,
      p_actor: actorString(user),
      p_total_delta: total_delta,
      p_damaged_delta: damaged_delta,
      p_note: note || null,
    });

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    const { data: updatedItem } = await supabase
      .from("bazaar_items")
      .select("*, category:bazaar_categories(id, name)")
      .eq("id", id)
      .single();

    return NextResponse.json({ ok: true, item: updatedItem });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
