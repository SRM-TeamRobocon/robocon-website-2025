import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applySplitAction, splitActionSchema, splitForViewer, SplitError } from "@/lib/team-splits";
import { readSplit, splitActor, splitBody, splitFailure, splitResponse } from "@/lib/team-splits-server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
async function splitId(context: Context) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) throw new SplitError("Split not found.", 404);
  return id;
}
export async function GET(_request: Request, context: Context) {
  try {
    const actor = await splitActor();
    const split = await readSplit(await splitId(context), actor);
    return splitResponse({ actor, data: splitForViewer(split, actor) });
  } catch (error) { return splitFailure(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await splitActor();
    const parsed = splitActionSchema.safeParse(await splitBody(request));
    if (!parsed.success) throw new SplitError(parsed.error.issues[0]?.message || "Invalid action.");
    const split = await readSplit(await splitId(context), actor);
    const next = applySplitAction(split, actor, parsed.data, new Date().toISOString());
    // Version comparison prevents a stale confirmation from approving a replaced report.
    const { data, error } = await createSupabaseAdminClient().from("team_splits")
      .update({ shares: next.shares, events: next.events, status: next.status, version: next.version })
      .eq("id", split.id).eq("version", split.version).select("id").maybeSingle();
    if (error) throw new Error("Could not update split.");
    if (!data) throw new SplitError("This split changed. Refresh before trying again.", 409);
    return splitResponse({ data: splitForViewer(next, actor) });
  } catch (error) { return splitFailure(error); }
}
