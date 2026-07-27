import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const MENTOR_DOMAIN = "MENTORS";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Promotes a mentor (members row, domain=MENTORS) to the alumni table, tagged with
// their profile's `year` as the alumni `batch`, then removes the mentor roster row.
export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: mentor, error: fetchError } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .eq("domain", MENTOR_DOMAIN)
    .single();

  if (fetchError || !mentor) {
    return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
  }

  const batch = mentor.year?.trim();
  if (!batch) {
    return NextResponse.json(
      { error: "Set a Year on this mentor's profile before promoting to Alumni." },
      { status: 400 }
    );
  }

  const { data: lastAlumnus } = await supabase
    .from("alumni")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: alumnus, error: insertError } = await supabase
    .from("alumni")
    .insert({
      name: mentor.name,
      designation: mentor.role,
      batch,
      photo_url: mentor.photo_url,
      linkedin_url: mentor.linkedin_url,
      instagram_url: mentor.instagram_url,
      facebook_url: mentor.facebook_url,
      display_order: (lastAlumnus?.display_order ?? 0) + 1,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase.from("members").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      {
        error: `Alumni record created, but removing the mentor entry failed: ${deleteError.message}. Delete it manually to avoid a duplicate.`,
        data: alumnus,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: alumnus });
}
