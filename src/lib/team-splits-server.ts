import "server-only";
import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SplitError, type SplitActor, type TeamSplit, canViewSplit } from "@/lib/team-splits";

export async function splitActor(): Promise<SplitActor> {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) throw new SplitError("Sign in to use Team Splits.", 401);
  if (!session.memberAccountId && session.role === "member") throw new SplitError("Your member account is not linked.", 403);
  return { key: session.memberAccountId ? `member:${session.memberAccountId}` : `staff:${session.user}`,
    memberId: session.memberAccountId ?? null, name: session.name || session.user };
}
export function splitResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function splitFailure(error: unknown) {
  if (error instanceof SplitError) return splitResponse({ error: error.message }, error.status);
  console.error("Team Splits request failed", error instanceof Error ? error.message : "Database operation failed");
  return splitResponse({ error: "Team Splits is unavailable. Please try again later." }, 503);
}
export async function readSplit(id: string, actor: SplitActor): Promise<TeamSplit> {
  const { data, error } = await createSupabaseAdminClient().from("team_splits").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not read team split.");
  if (!data || !canViewSplit(data, actor)) throw new SplitError("Split not found.", 404);
  return data;
}
export async function splitBody(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new SplitError("Request origin is not allowed.", 403);
  const raw = await request.text();
  if (raw.length > 30_000) throw new SplitError("Request is too large.", 413);
  try { return JSON.parse(raw); } catch { throw new SplitError("Invalid request."); }
}
