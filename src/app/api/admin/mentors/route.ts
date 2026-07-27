import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const MENTOR_DOMAIN = "MENTORS";

export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("domain", MENTOR_DOMAIN)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";

  if (!name || !role) {
    return NextResponse.json({ error: "Name and Role are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .insert({
      name,
      role,
      domain: MENTOR_DOMAIN,
      year: body.year || null,
      photo_url: body.photo_url || null,
      linkedin_url: body.linkedin_url || null,
      instagram_url: body.instagram_url || null,
      facebook_url: body.facebook_url || null,
      is_active: Boolean(body.is_active ?? true),
      display_order: Number(body.display_order) || 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";

  if (!name || !role) {
    return NextResponse.json({ error: "Name and Role are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .update({
      name,
      role,
      year: body.year || null,
      photo_url: body.photo_url || null,
      linkedin_url: body.linkedin_url || null,
      instagram_url: body.instagram_url || null,
      facebook_url: body.facebook_url || null,
      is_active: Boolean(body.is_active ?? true),
      display_order: Number(body.display_order) || 0,
    })
    .eq("id", id)
    .eq("domain", MENTOR_DOMAIN)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("members").delete().eq("id", id).eq("domain", MENTOR_DOMAIN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
