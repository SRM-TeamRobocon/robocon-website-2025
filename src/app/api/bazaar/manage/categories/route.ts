import { NextRequest, NextResponse } from "next/server";
import { requireViewer, requireLead, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { categorySchema } from "@/lib/bazaar/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireViewer();
    const supabase = getBazaarDb();
    const { data, error } = await supabase
      .from("bazaar_categories")
      .select("id, name, created_at")
      .order("name", { ascending: true });

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    return NextResponse.json({ categories: data || [] });
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
      .insert({ name })
      .select("id, name, created_at")
      .single();

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    await supabase.from("bazaar_activity_log").insert({
      actor: actorString(user),
      action: "category_created",
      detail: { category_id: data.id, name },
    });

    return NextResponse.json({ category: data }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
