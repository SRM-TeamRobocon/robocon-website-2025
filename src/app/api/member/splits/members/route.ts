import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { splitActor, splitFailure, splitResponse } from "@/lib/team-splits-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const actor = await splitActor();
    const { data, error } = await createSupabaseAdminClient().from("member_accounts")
      .select("id, name, domain").eq("is_approved", true).order("name").limit(1000);
    if (error) throw new Error("Could not load participants.");
    return splitResponse({ data: data.filter(m => m.id !== actor.memberId) });
  } catch (error) { return splitFailure(error); }
}
