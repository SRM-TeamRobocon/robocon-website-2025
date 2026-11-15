import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { createCalendarAdminClient } from "@/lib/supabase/calendar-admin";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["lead", "admin", "member"] as const;

// ─── GET /api/calendar/birthdays ─────────────────────────────────────────────
export async function GET() {
  try {
    const session = await getSession();
    if (!requireRole(session, [...ALLOWED_ROLES])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createCalendarAdminClient();
    const { data, error } = await supabase
      .from("calendar_birthdays")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return NextResponse.json(
          {
            success: false,
            error: "Tables not created yet in Supabase. Please run supabase/calendar-schema.sql.",
            code: "PGRST205",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    console.error("GET /api/calendar/birthdays error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/calendar/birthdays ────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!requireRole(session, [...ALLOWED_ROLES])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, date_of_birth, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    if (!date_of_birth || typeof date_of_birth !== "string") {
      return NextResponse.json({ success: false, error: "Date of birth is required" }, { status: 400 });
    }

    // Authenticated user UUID: resolve strictly from verified session
    const createdBy = session.memberAccountId || session.rosterId || null;

    const supabase = createCalendarAdminClient();
    const { data, error } = await supabase
      .from("calendar_birthdays")
      .insert({
        name: name.trim(),
        date_of_birth,
        description: description?.trim() || null,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST205") {
        return NextResponse.json({ success: false, error: "Database table not ready", code: "PGRST205" }, { status: 503 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("POST /api/calendar/birthdays error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// ─── PUT /api/calendar/birthdays ─────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!requireRole(session, [...ALLOWED_ROLES])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, date_of_birth, description } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Birthday ID is required" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    if (!date_of_birth) {
      return NextResponse.json({ success: false, error: "Date of birth is required" }, { status: 400 });
    }

    const supabase = createCalendarAdminClient();

    // Preserve original created_by attribution
    const { data, error } = await supabase
      .from("calendar_birthdays")
      .update({
        name: name.trim(),
        date_of_birth,
        description: description?.trim() || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("PUT /api/calendar/birthdays error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/calendar/birthdays ──────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!requireRole(session, [...ALLOWED_ROLES])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Birthday ID is required" }, { status: 400 });
    }

    const supabase = createCalendarAdminClient();
    const { error } = await supabase.from("calendar_birthdays").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("DELETE /api/calendar/birthdays error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
