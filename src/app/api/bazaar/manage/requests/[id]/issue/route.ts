import { NextRequest, NextResponse } from "next/server";
import { requireLead, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { sendRequestIssuedEmail } from "@/lib/bazaar/email";
import { BazaarRequest } from "@/lib/bazaar/types";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireLead();
    const { id } = await segmentData.params;

    const supabase = getBazaarDb();
    const { error } = await supabase.rpc("bazaar_issue_request", {
      p_request: id,
      p_actor: actorString(user),
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
          await sendRequestIssuedEmail(updatedReq as unknown as BazaarRequest);
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
