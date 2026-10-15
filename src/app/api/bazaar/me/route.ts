import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/bazaar/auth";
import { jsonError } from "@/lib/bazaar/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonError("BAZAAR_UNAUTHENTICATED", "Not authenticated", 401);
    }
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        regNumber: user.regNumber,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
