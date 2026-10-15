import { NextRequest, NextResponse } from "next/server";
import { requireLead, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { cancelRequestSchema } from "@/lib/bazaar/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireLead();
    const { id } = await segmentData.params;

    let note: string | null = null;
    try {
      const body = await request.json();
      const parsed = cancelRequestSchema.safeParse(body);
      if (parsed.success && parsed.data.note) {
        note = parsed.data.note;
      }
    } catch {
      // Empty body is valid
    }

    const supabase = getBazaarDb();
    const { error } = await supabase.rpc("bazaar_cancel_request", {
      p_request: id,
      p_actor: actorString(user),
      p_note: note,
    });

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
