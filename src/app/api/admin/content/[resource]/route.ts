import { NextRequest, NextResponse } from "next/server";
import { getContentResource, type ContentResourceConfig } from "@/lib/content-resources";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ resource: string }>;
};

export const dynamic = "force-dynamic";

function cleanString(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePayload(config: ContentResourceConfig, body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  for (const field of config.fields) {
    if (field.readonly && field.name !== "is_read") continue;
    if (!(field.name in body)) continue;

    const value = body[field.name];

    if (field.type === "number") {
      payload[field.name] = value === "" || value === null || value === undefined ? 0 : Number(value);
      continue;
    }

    if (field.type === "boolean") {
      payload[field.name] = Boolean(value);
      continue;
    }

    if (field.type === "tags") {
      payload[field.name] = Array.isArray(value)
        ? value.map((item) => String(item).trim()).filter(Boolean)
        : String(value ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
      continue;
    }

    if (field.type === "datetime") {
      const normalized = cleanString(value);
      payload[field.name] = typeof normalized === "string" ? new Date(normalized).toISOString() : normalized;
      continue;
    }

    payload[field.name] = cleanString(value);
  }

  return payload;
}

async function getConfig(context: RouteContext) {
  const { resource } = await context.params;
  return getContentResource(resource);
}

export async function GET(_request: NextRequest, context: RouteContext) {
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

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest, context: RouteContext) {
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
