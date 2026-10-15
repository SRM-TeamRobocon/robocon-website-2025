import { NextRequest, NextResponse } from "next/server";
import { requireLead, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { returnRequestSchema } from "@/lib/bazaar/validation";
import { sendRequestReturnedEmail } from "@/lib/bazaar/email";
import { BazaarRequest } from "@/lib/bazaar/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireLead();
    const { id } = await segmentData.params;
    const body = await request.json();

    const parsed = returnRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        "BAZAAR_VALIDATION",
        parsed.error.issues[0]?.message || "Validation failed",
        400,
        parsed.error.format()
      );
    }

    const { good, damaged, lost, note } = parsed.data;
    const supabase = getBazaarDb();

    const { error } = await supabase.rpc("bazaar_return_request", {
      p_request: id,
      p_actor: actorString(user),
      p_good: good,
      p_damaged: damaged,
      p_lost: lost,
      p_note: note || null,
    });

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    (async () => {
      try {
        const { data: updatedReq } = await supabase
          .from("bazaar_requests")
          .select("*, item:bazaar_items(id, name)")
          .eq("id", id)
          .single();

        if (updatedReq) {
          await sendRequestReturnedEmail(updatedReq as unknown as BazaarRequest);
        }
      } catch {
        // Silently caught in background
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
