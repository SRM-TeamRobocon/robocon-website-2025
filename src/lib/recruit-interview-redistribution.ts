import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by "Close for the Day" and panel deletion — both need to get every `waiting`
// recruit off a table that's going away onto another open table for the same domain, or
// (if none is open) flip them to `deferred` rather than stranding them.

const POSITION_GAP = 1000;

type DisplacedToken = { id: string; recruit_id: string; checked_in_at: string };
type TargetPanel = { id: string; table_number: number | null };
type TimelineEntry = { checked_in_at: string; queue_position: number };
type PanelRef = { id: string; cycle_id: string; sub_domain: string | null };

export type RedistributeResult = { moved: number; deferred: number };

// Moves every `waiting` token off `panel` onto whichever other currently-active table for
// the same domain has the fewest people waiting (recomputed after each move, so it stays
// balanced), landing in that table's queue at the position matching their ORIGINAL
// check-in time relative to who's already there. If no other table for the domain is
// active, marks them `deferred` ("come back another day for this domain") instead of
// leaving them `waiting` on a table that will never call them again.
//
// Does NOT touch `panel`'s own row (is_active, deletion, etc.) — callers do that
// themselves before or after, per their own semantics.
export async function redistributeWaitingTokens(
  supabase: SupabaseClient,
  panel: PanelRef
): Promise<RedistributeResult> {
  const { data: displaced, error: displacedError } = await supabase
    .from("recruit_interview_tokens")
    .select("id, recruit_id, checked_in_at")
    .eq("panel_id", panel.id)
    .eq("status", "waiting")
    .order("checked_in_at", { ascending: true });

  if (displacedError) throw new Error(displacedError.message);

  const waitingTokens = (displaced ?? []) as DisplacedToken[];
  if (waitingTokens.length === 0) {
    return { moved: 0, deferred: 0 };
  }

  const deferAll = async () => {
    const { error } = await supabase
      .from("recruit_interview_tokens")
      .update({ status: "deferred" })
      .in(
        "id",
        waitingTokens.map((t) => t.id)
      );
    if (error) throw new Error(error.message);
    return { moved: 0, deferred: waitingTokens.length };
  };

  // No domain to match same-domain tables against (legacy panel with no sub_domain) —
  // nothing to redistribute onto.
  if (!panel.sub_domain) {
    return deferAll();
  }

  const { data: otherPanelsRaw, error: otherPanelsError } = await supabase
    .from("recruit_interview_panels")
    .select("id, table_number")
    .eq("cycle_id", panel.cycle_id)
    .eq("sub_domain", panel.sub_domain)
    .eq("is_active", true)
    .neq("id", panel.id)
    .order("table_number", { ascending: true });

  if (otherPanelsError) throw new Error(otherPanelsError.message);

  const otherPanels = (otherPanelsRaw ?? []) as TargetPanel[];
  if (otherPanels.length === 0) {
    return deferAll();
  }

  // Per-target load + timeline snapshot, both mutated in-memory as tokens get assigned so
  // later displaced recruits see the effect of earlier ones in this same batch — greedy
  // least-loaded balancing without a DB round trip per assignment.
  const { data: existingTokensRaw } = await supabase
    .from("recruit_interview_tokens")
    .select("panel_id, checked_in_at, queue_position, token_number")
    .in(
      "panel_id",
      otherPanels.map((p) => p.id)
    )
    .eq("status", "waiting");

  const existingTokens = (existingTokensRaw ?? []) as {
    panel_id: string;
    checked_in_at: string;
    queue_position: number;
    token_number: number;
  }[];

  const load = new Map<string, number>(otherPanels.map((p) => [p.id, 0]));
  const timeline = new Map<string, TimelineEntry[]>(otherPanels.map((p) => [p.id, []]));
  const nextTokenNumber = new Map<string, number>(otherPanels.map((p) => [p.id, 1]));

  for (const t of existingTokens) {
    load.set(t.panel_id, (load.get(t.panel_id) ?? 0) + 1);
    timeline.get(t.panel_id)?.push({ checked_in_at: t.checked_in_at, queue_position: t.queue_position });
    nextTokenNumber.set(t.panel_id, Math.max(nextTokenNumber.get(t.panel_id) ?? 1, t.token_number + 1));
  }
  for (const entries of Array.from(timeline.values())) {
    entries.sort((a, b) => a.queue_position - b.queue_position);
  }

  let moved = 0;
  let deferred = 0;

  for (const token of waitingTokens) {
    let target = otherPanels[0];
    let targetLoad = load.get(target.id) ?? 0;
    for (const p of otherPanels.slice(1)) {
      const l = load.get(p.id) ?? 0;
      if (l < targetLoad) {
        target = p;
        targetLoad = l;
      }
    }

    const entries = timeline.get(target.id) ?? [];
    let insertAt = entries.length;
    for (let i = 0; i < entries.length; i++) {
      if (new Date(token.checked_in_at).getTime() < new Date(entries[i].checked_in_at).getTime()) {
        insertAt = i;
        break;
      }
    }
    const before = entries[insertAt - 1];
    const after = entries[insertAt];
    const newPosition = before && after
      ? (before.queue_position + after.queue_position) / 2
      : before
        ? before.queue_position + POSITION_GAP
        : after
          ? after.queue_position - POSITION_GAP
          : POSITION_GAP;

    const tokenNumber = nextTokenNumber.get(target.id) ?? 1;
    nextTokenNumber.set(target.id, tokenNumber + 1);

    const { error: moveError } = await supabase
      .from("recruit_interview_tokens")
      .update({ panel_id: target.id, token_number: tokenNumber, queue_position: newPosition })
      .eq("id", token.id)
      .eq("status", "waiting");

    if (moveError) {
      // Very unlikely (a concurrent scan into the target table grabbed the same
      // token_number) — defer this one rather than fail the whole batch.
      await supabase.from("recruit_interview_tokens").update({ status: "deferred" }).eq("id", token.id);
      deferred += 1;
      continue;
    }

    entries.splice(insertAt, 0, { checked_in_at: token.checked_in_at, queue_position: newPosition });
    load.set(target.id, (load.get(target.id) ?? 0) + 1);
    moved += 1;
  }

  return { moved, deferred };
}

// For panel deletion only: recruit_interview_tokens.panel_id is `not null references
// recruit_interview_panels(id)` with no ON DELETE CASCADE — every token still pointing at
// `panel.id` (called/done/no_show/deferred; `waiting` ones should already have been moved
// by redistributeWaitingTokens) must be reassigned to SOME other still-existing panel for
// the same domain before the row can be deleted. They don't need a *correct* table, just a
// *valid* one: none of these statuses are rendered via panel affiliation anywhere, so
// pointing a `deferred` or `done` token at an unrelated table for the same domain is
// invisible to everyone. Falls back to ANY panel in the cycle if none share the domain —
// better than blocking the delete outright.
export async function reattachHistoricalTokens(
  supabase: SupabaseClient,
  panel: PanelRef
): Promise<{ ok: true; reattached: number } | { ok: false; reason: string }> {
  const { data: remaining, error: remainingError } = await supabase
    .from("recruit_interview_tokens")
    .select("id")
    .eq("panel_id", panel.id);

  if (remainingError) throw new Error(remainingError.message);
  if (!remaining || remaining.length === 0) {
    return { ok: true, reattached: 0 };
  }

  let fallback: { id: string } | null = null;

  if (panel.sub_domain) {
    const { data } = await supabase
      .from("recruit_interview_panels")
      .select("id")
      .eq("cycle_id", panel.cycle_id)
      .eq("sub_domain", panel.sub_domain)
      .neq("id", panel.id)
      .limit(1)
      .maybeSingle();
    fallback = data;
  }

  if (!fallback) {
    const { data } = await supabase
      .from("recruit_interview_panels")
      .select("id")
      .eq("cycle_id", panel.cycle_id)
      .neq("id", panel.id)
      .limit(1)
      .maybeSingle();
    fallback = data;
  }

  if (!fallback) {
    return {
      ok: false,
      reason:
        "This is the only interview table that has ever existed for this cycle, and it has recorded history (interviews, no-shows, or deferrals) — deleting it would orphan that history. Use \"Close for the Day\" instead, or create another table first.",
    };
  }

  const { error: reattachError } = await supabase
    .from("recruit_interview_tokens")
    .update({ panel_id: fallback.id })
    .eq("panel_id", panel.id);

  if (reattachError) throw new Error(reattachError.message);

  return { ok: true, reattached: remaining.length };
}
