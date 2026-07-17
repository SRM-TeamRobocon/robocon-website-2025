import { NextRequest, NextResponse } from "next/server";
import { getContentResource } from "@/lib/content-resources";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

type RouteContext = {
  params: Promise<{ resource: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext) {
  const { resource } = await context.params;
  const config = getContentResource(resource);

  if (!config || config.table === "contact_submissions") {
    return NextResponse.json({ error: "Unknown content resource" }, { status: 404 });
  }

  const supabase = createPublicSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ data: [], configured: false });
  }

  const query = (supabase.from(config.table) as any)
    .select(config.table === "gallery" ? "*, gallery_albums(id, title)" : "*")
    .order(config.orderBy, { ascending: config.ascending });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], configured: true });
}
