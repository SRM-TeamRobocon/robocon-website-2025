import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Gallery photos share one global order counter (append-to-end), regardless of album. */
export async function nextGalleryDisplayOrder(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("gallery")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.display_order ?? 0) + 1;
}
