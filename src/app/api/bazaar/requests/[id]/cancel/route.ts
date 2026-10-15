import { NextRequest, NextResponse } from "next/server";
import { requireUser, actorString } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { cancelRequestSchema } from "@/lib/bazaar/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await segmentData.params;

    let note: string | null = null;
    try {
      const body = await request.json();
      const parsed = cancelRequestSchema.safeParse(body);
      if (parsed.success && parsed.data.note) {
        note = parsed.data.note;
      }
    } catch {
      // Empty body is acceptable for cancel
    }

    const supabase = getBazaarDb();

    // Verify ownership: member can only cancel their own request
    const { data: req, error: findError } = await supabase
      .from("bazaar_requests")
      .select("id, member_id, status")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      const mapped = mapDbError(findError);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    const reqData = req as unknown as any;
    // Return 404 if not found or belongs to another user
    if (!reqData || reqData.member_id !== user.id) {
      return jsonError("BAZAAR_NOT_FOUND", "Request not found", 404);
    }

    const { error: cancelError } = await supabase.rpc("bazaar_cancel_request", {
      p_request: id,
      p_actor: actorString(user),
      p_note: note,
    });

    if (cancelError) {
      const mapped = mapDbError(cancelError);
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
