import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/session";
import { createCalendarAdminClient } from "@/lib/supabase/calendar-admin";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["lead", "admin", "member"] as const;

// ─── GET /api/calendar/birthdays ─────────────────────────────────────────────
// Calls get_member_birthdays() RPC to retrieve name + birth month/day only.
// Never exposes email, phone, or birth year.
export async function GET() {
  try {
    const session = await getSession();
    if (!requireRole(session, [...ALLOWED_ROLES])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createCalendarAdminClient();

    const { data, error } = await supabase.rpc("get_member_birthdays");

    if (error) {
      // RPC not yet created: fall back to direct column query so the calendar
      // doesn't break before the SQL is applied.
      if (
        error.code === "PGRST202" ||
        error.message?.includes("get_member_birthdays") ||
        error.message?.includes("Could not find")
      ) {
        const fallback = await supabase
          .from("member_accounts")
          .select("id, name, date_of_birth")
          .not("date_of_birth", "is", null)
          .order("name", { ascending: true });

        if (fallback.error) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Birthday RPC not found and direct fallback also failed. " +
                "Please run supabase/calendar-schema.sql in the Supabase SQL Editor.",
              code: fallback.error.code,
            },
            { status: 503 }
          );
        }

        // Map direct-query rows to the same shape as the RPC
        const sanitized = (fallback.data || [])
          .filter((r: any) => r?.name && r?.date_of_birth)
          .map((r: any) => {
            const parts = String(r.date_of_birth).split("-").map(Number);
            if (parts.length < 2) return null;
            const [birth_month, birth_day] =
              parts.length >= 3 ? [parts[1], parts[2]] : [parts[0], parts[1]];
            if (!birth_month || !birth_day) return null;
            return {
              member_account_id: r.id,
              name: r.name,
              birth_month,
              birth_day,
            };
          })
          .filter(Boolean);

        return NextResponse.json({ success: true, data: sanitized, via: "fallback" });
      }

      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // RPC rows: { member_account_id, name, birth_month, birth_day }
    const sanitized = (data || []).filter(
      (r: any) => r?.name && r?.birth_month >= 1 && r?.birth_day >= 1
    );

    return NextResponse.json({ success: true, data: sanitized });
  } catch (err: any) {
    console.error("GET /api/calendar/birthdays error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST /api/calendar/birthdays ────────────────────────────────────────────
// Sets date_of_birth on a member_account record (lead/admin only).
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, date_of_birth } = body;

    if (!date_of_birth || typeof date_of_birth !== "string") {
      return NextResponse.json({ success: false, error: "Valid date of birth is required" }, { status: 400 });
    }
    // Accept YYYY-MM-DD or MM-DD
    const parts = date_of_birth.trim().split("-").map(Number);
    if (parts.some(isNaN) || parts.length < 2) {
      return NextResponse.json({ success: false, error: "date_of_birth must be YYYY-MM-DD or MM-DD" }, { status: 400 });
    }
    const [month, day] = parts.length >= 3 ? [parts[1], parts[2]] : [parts[0], parts[1]];
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return NextResponse.json({ success: false, error: "Invalid date_of_birth value" }, { status: 400 });
    }

    const supabase = createCalendarAdminClient();

    if (id) {
      const { data, error } = await supabase
        .from("member_accounts")
        .update({ date_of_birth })
        .eq("id", id)
        .select("id, name, date_of_birth")
        .maybeSingle();

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ success: false, error: "Member account not found" }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Member name or ID is required" }, { status: 400 });
    }

    const { data: member, error: findError } = await supabase
      .from("member_accounts")
      .select("id, name")
      .ilike("name", name.trim())
      .maybeSingle();

    if (findError) return NextResponse.json({ success: false, error: findError.message }, { status: 500 });
    if (!member) {
      return NextResponse.json(
        { success: false, error: `No member account found with name "${name.trim()}"` },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("member_accounts")
      .update({ date_of_birth })
      .eq("id", member.id)
      .select("id, name, date_of_birth")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
    if (!requireRole(session, ["lead", "admin"])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, date_of_birth } = body;

    if (!id) return NextResponse.json({ success: false, error: "Member account ID is required" }, { status: 400 });
    if (!date_of_birth || typeof date_of_birth !== "string") {
      return NextResponse.json({ success: false, error: "Valid date of birth is required" }, { status: 400 });
    }

    const supabase = createCalendarAdminClient();
    const { data, error } = await supabase
      .from("member_accounts")
      .update({ date_of_birth })
      .eq("id", id)
      .select("id, name, date_of_birth")
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ success: false, error: "Member account not found" }, { status: 404 });
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
    if (!requireRole(session, ["lead", "admin"])) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ success: false, error: "Member account ID is required" }, { status: 400 });

    const supabase = createCalendarAdminClient();
    const { error } = await supabase
      .from("member_accounts")
      .update({ date_of_birth: null })
      .eq("id", id);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("DELETE /api/calendar/birthdays error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
