import { NextRequest, NextResponse } from "next/server";
import { getContentResource, normalizePayload } from "@/lib/content-resources";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { nextGalleryDisplayOrder } from "@/lib/gallery";

type RouteContext = {
  params: Promise<{ resource: string }>;
};

export const dynamic = "force-dynamic";

async function getConfig(context: RouteContext) {
  const { resource } = await context.params;
  return getContentResource(resource);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getConfig(context);

  if (!config) {
    return NextResponse.json({ error: "Unknown content resource" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await (supabase.from(config.table) as any)
    .select("*")
    .order(config.orderBy, { ascending: config.ascending });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mentors are historical roster entries, not active members/leads - keep them out of the
  // website content manager (they aren't meant to be edited or re-published from here).
  const rows =
    config.table === "members"
      ? (data ?? []).filter((row: any) => (row.domain || "").toUpperCase() !== "MENTORS")
      : data ?? [];

  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getConfig(context);

  if (!config || config.readonly) {
    return NextResponse.json({ error: "This resource cannot be created here" }, { status: 400 });
  }

  const body = await request.json();
  const payload = normalizePayload(config, body);

  for (const field of config.fields) {
    if (field.required && !payload[field.name]) {
      return NextResponse.json({ error: `${field.label} is required` }, { status: 400 });
    }
  }

  const supabase = createSupabaseAdminClient();

  if (config.table === "gallery") {
    payload.display_order = await nextGalleryDisplayOrder(supabase);
  }

  const { data, error } = await (supabase.from(config.table) as any)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getConfig(context);

  if (!config) {
    return NextResponse.json({ error: "Unknown content resource" }, { status: 404 });
  }

  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : null;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const payload = normalizePayload(config, body);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await (supabase.from(config.table) as any)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getConfig(context);

  if (!config || config.readonly) {
    return NextResponse.json({ error: "This resource cannot be deleted here" }, { status: 400 });
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await (supabase.from(config.table) as any).delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
