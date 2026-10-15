import { NextResponse } from "next/server";
import { requireUser } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
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
