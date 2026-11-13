import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applySplitAction, canDeleteSplit, collectorKey, createSplitSchema, editSplit, splitCsv, splitActionSchema, splitForViewer, SplitError } from "@/lib/team-splits";
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
    if (new URL(_request.url).searchParams.get("format") === "csv") {
      if (actor.key !== split.creator_key && actor.key !== collectorKey(split)) throw new SplitError("Only the creator or collector can export this split.", 403);
      return new Response(splitCsv(split), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="split-${split.id}.csv"`, "Cache-Control": "private, no-store" } });
    }
    return splitResponse({ actor, data: splitForViewer(split, actor) });
  } catch (error) { return splitFailure(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    const actor = await splitActor();
    const parsed = createSplitSchema.extend({ version: z.number().int().min(0) }).safeParse(await splitBody(request));
    if (!parsed.success) throw new SplitError(parsed.error.issues[0]?.message || "Invalid split.");
    const split = await readSplit(await splitId(context), actor);
    const input = parsed.data;
    const ids = Array.from(new Set([...input.participants.map(p => p.memberId), ...(input.collectorMemberId ? [input.collectorMemberId] : [])]));
    const db = createSupabaseAdminClient();
    const { data: members, error: memberError } = await db.from("member_accounts").select("id, name, domain").eq("is_approved", true).in("id", ids);
    if (memberError) throw new Error("Could not check members.");
    const next = editSplit(split, actor, input, members, input.version, new Date().toISOString());
    const { data, error } = await db.from("team_splits").update(next).eq("id", split.id).eq("version", input.version).select("id").maybeSingle();
    if (error) throw new Error("Could not edit split.");
    if (!data) throw new SplitError("This split changed. Refresh before editing.", 409);
    return splitResponse({ id: split.id });
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
export async function DELETE(request: Request, context: Context) {
  try {
    const actor = await splitActor();
    const body = z.object({ version: z.number().int().min(0) }).strict().safeParse(await splitBody(request));
    if (!body.success) throw new SplitError("Invalid delete request.");
    const split = await readSplit(await splitId(context), actor);
    if (!canDeleteSplit(split, actor)) throw new SplitError("Only the creator can delete a split before any payment activity.", 409);
    const { data, error } = await createSupabaseAdminClient().from("team_splits")
      .delete().eq("id", split.id).eq("version", body.data.version).select("id").maybeSingle();
    if (error) throw new Error("Could not delete split.");
    if (!data) throw new SplitError("This split changed. Refresh before trying again.", 409);
    return splitResponse({ deleted: true });
  } catch (error) { return splitFailure(error); }
}
