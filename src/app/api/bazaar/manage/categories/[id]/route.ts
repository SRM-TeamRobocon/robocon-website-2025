import { NextRequest, NextResponse } from "next/server";
import { requireLead, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { categorySchema } from "@/lib/bazaar/validation";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireLead();
    const { id } = await segmentData.params;
    const body = await request.json();

    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        "BAZAAR_VALIDATION",
        parsed.error.issues[0]?.message || "Validation failed",
        400,
        parsed.error.format()
      );
    }

    const { name } = parsed.data;
    const supabase = getBazaarDb();
    const { data, error } = await supabase
      .from("bazaar_categories")
      .update({ name })
      .eq("id", id)
      .select("id, name, created_at")
      .maybeSingle();

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    if (!data) {
      return jsonError("BAZAAR_NOT_FOUND", "Category not found", 404);
    }

    await supabase.from("bazaar_activity_log").insert({
      actor: actorString(user),
      action: "category_updated",
      detail: { category_id: id, name },
    });

    return NextResponse.json({ category: data });
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
    const { error } = await supabase
      .from("bazaar_categories")
      .delete()
      .eq("id", id);

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    await supabase.from("bazaar_activity_log").insert({
      actor: actorString(user),
      action: "category_deleted",
      detail: { category_id: id },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
