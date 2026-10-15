import { NextRequest, NextResponse } from "next/server";
import { requireLead, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { approveRequestSchema } from "@/lib/bazaar/validation";
import { sendRequestApprovedEmail, sendRequestIssuedEmail } from "@/lib/bazaar/email";
import { BazaarRequest } from "@/lib/bazaar/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireLead();
    const { id } = await segmentData.params;

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is valid
    }

    const parsed = approveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        "BAZAAR_VALIDATION",
        parsed.error.issues[0]?.message || "Validation failed",
        400,
        parsed.error.format()
      );
    }

    const { note, issue } = parsed.data;
    const supabase = getBazaarDb();

    const { error } = await supabase.rpc("bazaar_approve_request", {
      p_request: id,
      p_actor: actorString(user),
      p_note: note || null,
      p_issue: issue,
    });

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    // Fetch updated request for email notification
    (async () => {
      try {
        const { data: updatedReq } = await supabase
          .from("bazaar_requests")
          .select("*, item:bazaar_items(id, name)")
          .eq("id", id)
          .single();

        if (updatedReq) {
          const reqTyped = updatedReq as unknown as BazaarRequest;
          if (issue) {
            await sendRequestIssuedEmail(reqTyped);
          } else {
            await sendRequestApprovedEmail(reqTyped);
          }
        }
      } catch {
        // Silently caught in background task
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
