import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { splitActor, splitFailure, splitResponse } from "@/lib/team-splits-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const actor = await splitActor();
    const { data, error } = await createSupabaseAdminClient().rpc("team_split_overview", { p_actor_key: actor.key, p_member_id: actor.memberId });
    if (error) throw new Error("Could not load split totals.");
    return splitResponse({ data });
  } catch (error) { return splitFailure(error); }
}
