import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { createCalendarAdminClient } from "@/lib/supabase/calendar-admin";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["lead", "admin", "member"] as const;

// ─── GET /api/calendar/events ────────────────────────────────────────────────
export async function GET() {
  try {
    const session = await getSession();
    if (!requireRole(session, [...ALLOWED_ROLES])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createCalendarAdminClient();
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("start_at", { ascending: true });

    if (error) {
      // If table has not yet been applied in Supabase SQL editor
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
    console.error("GET /api/calendar/events error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/calendar/events ───────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!requireRole(session, [...ALLOWED_ROLES])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, start_at, end_at, category, location } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }
    if (!start_at || !end_at) {
      return NextResponse.json({ success: false, error: "Start and end dates are required" }, { status: 400 });
    }
    if (new Date(end_at) < new Date(start_at)) {
      return NextResponse.json({ success: false, error: "End date cannot precede start date" }, { status: 400 });
    }

    const validCategories = ["Meeting", "Competition", "Workshop", "Deadline", "Team Activity", "Other"];
    const eventCategory = validCategories.includes(category) ? category : "Other";

    // Authenticated user UUID: resolve strictly from verified session
    const createdBy = session.memberAccountId || session.rosterId || null;

    const supabase = createCalendarAdminClient();
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        start_at,
        end_at,
        category: eventCategory,
        location: location?.trim() || null,
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
    console.error("POST /api/calendar/events error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// ─── PUT /api/calendar/events ────────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!requireRole(session, [...ALLOWED_ROLES])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, description, start_at, end_at, category, location } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Event ID is required" }, { status: 400 });
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }
    if (!start_at || !end_at) {
      return NextResponse.json({ success: false, error: "Start and end dates are required" }, { status: 400 });
    }
    if (new Date(end_at) < new Date(start_at)) {
      return NextResponse.json({ success: false, error: "End date cannot precede start date" }, { status: 400 });
    }

    const validCategories = ["Meeting", "Competition", "Workshop", "Deadline", "Team Activity", "Other"];
    const eventCategory = validCategories.includes(category) ? category : "Other";

    const supabase = createCalendarAdminClient();

    // Preserve original created_by attribution
    const { data, error } = await supabase
      .from("calendar_events")
      .update({
        title: title.trim(),
        description: description?.trim() || null,
        start_at,
        end_at,
        category: eventCategory,
        location: location?.trim() || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("PUT /api/calendar/events error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/calendar/events ─────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!requireRole(session, [...ALLOWED_ROLES])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Event ID is required" }, { status: 400 });
    }

    const supabase = createCalendarAdminClient();
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("DELETE /api/calendar/events error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
