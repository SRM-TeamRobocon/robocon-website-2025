import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateShares, coverCollectorShare, createSplitSchema, parseRupees, sameCreateRequest, SplitError, type TeamSplit } from "@/lib/team-splits";
import { splitActor, splitBody, splitFailure, splitResponse } from "@/lib/team-splits-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await splitActor();
    const db = createSupabaseAdminClient();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || "0");
    if (!Number.isInteger(page) || page < 0 || page > 10000) throw new SplitError("Invalid page.");
    const requestedScope = url.searchParams.get("scope");
    const scope = requestedScope === "created" || requestedScope === "collecting" ? requestedScope : "owed";
    let query = db.from("team_splits").select("id, title, creator_name, creator_key, collector_member_id, collector_name, total_paise, shares, status, created_at").order("created_at", { ascending: false }).order("id").range(page * 20, page * 20 + 20);
    if (scope === "created") query = query.eq("creator_key", actor.key);
    else if (scope === "collecting" && actor.memberId) query = query.eq("collector_member_id", actor.memberId);
    else if (actor.memberId) query = query.contains("participant_ids", [actor.memberId]);
    else return splitResponse({ actor, data: [], hasMore: false });
    const { data, error } = await query;
    if (error) throw new Error("Could not list team splits.");
    return splitResponse({ actor, hasMore: data.length > 20, data: data.slice(0, 20).map(split => ({
      id: split.id, title: split.title, creatorName: split.creator_name, collectorName: split.collector_name || split.creator_name, totalPaise: split.total_paise,
      status: split.status, createdAt: split.created_at,
      confirmedPaise: split.shares.filter(s => s.status === "confirmed").reduce((sum, s) => sum + s.amountPaise, 0),
      reportedCount: split.shares.filter(s => s.status === "reported").length,
      mine: split.shares.find(s => s.memberId === actor.memberId) ? {
        amountPaise: split.shares.find(s => s.memberId === actor.memberId)!.amountPaise,
        status: split.shares.find(s => s.memberId === actor.memberId)!.status,
      } : null,
    })) });
  } catch (error) { return splitFailure(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await splitActor();
    const parsed = createSplitSchema.safeParse(await splitBody(request));
    if (!parsed.success) throw new SplitError(parsed.error.issues[0]?.message || "Invalid split.");
    const input = parsed.data;
    const db = createSupabaseAdminClient();
    const { data: existing, error: lookupError } = await db.from("team_splits").select("*").eq("id", input.id).maybeSingle();
    if (lookupError) throw new Error("Could not check request.");
    if (existing) {
      if (existing.creator_key !== actor.key) throw new SplitError("Request ID is unavailable.", 409);
      if (!sameCreateRequest(existing, input, actor.memberId)) throw new SplitError("A split was already created from this form with different details. Open your existing split from Created by me.", 409);
      return splitResponse({ id: existing.id });
    }
    const memberIds = Array.from(new Set([...input.participants.map(p => p.memberId), ...(input.collectorMemberId ? [input.collectorMemberId] : [])]));
    const { data: members, error } = await db.from("member_accounts").select("id, name, domain").eq("is_approved", true).in("id", memberIds);
    if (error) throw new Error("Could not check participants.");
    const collector = input.collectorMemberId ? members.find(m => m.id === input.collectorMemberId) : null;
    if (input.collectorMemberId && !collector) throw new SplitError("Collector must be an approved member.");
    const shares = coverCollectorShare(allocateShares(input, members, actor.memberId), input.collectorMemberId ?? actor.memberId, new Date().toISOString());
    const split: TeamSplit = { id: input.id, creator_key: actor.key, creator_name: actor.name,
      collector_member_id: input.collectorMemberId, collector_name: collector?.name ?? actor.name,
      title: input.title, description: input.description, upi_id: input.upiId, payee_name: input.payeeName,
      total_paise: parseRupees(input.total), participant_ids: shares.map(s => s.memberId), shares,
      events: [{ action: "created", actor: actor.key, memberId: null, at: new Date().toISOString() }],
      status: "open", version: 0, created_at: new Date().toISOString() };
    const { error: insertError } = await db.from("team_splits").insert(split);
    if (insertError?.code === "23505") {
      const { data: retry } = await db.from("team_splits").select("*").eq("id", input.id).maybeSingle();
      if (retry?.creator_key === actor.key) {
        if (!sameCreateRequest(retry, input, actor.memberId)) throw new SplitError("A split was already created from this form with different details. Open your existing split from Created by me.", 409);
        return splitResponse({ id: input.id });
      }
    }
    if (insertError) throw new Error("Could not create split.");
    return splitResponse({ id: split.id }, 201);
  } catch (error) { return splitFailure(error); }
}
