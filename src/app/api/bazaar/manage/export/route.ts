import { NextRequest, NextResponse } from "next/server";
import { requireLead } from "@/lib/bazaar/auth";
import { getBazaarDb } from "@/lib/bazaar/supabase";
import { jsonError, mapDbError, BazaarError } from "@/lib/bazaar/errors";
import { buildCsv } from "@/lib/bazaar/csv";
import { todayIST, formatDate } from "@/lib/bazaar/dates";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireLead();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "requests";
    const today = todayIST();

    const supabase = getBazaarDb();

    if (type === "items") {
      const { data, error } = await supabase
        .from("bazaar_items")
        .select("*, category:bazaar_categories(name)")
        .order("name", { ascending: true });

      if (error) {
        const mapped = mapDbError(error);
        return jsonError(mapped.code, mapped.message, mapped.status);
      }

      const headers = [
        "Item ID",
        "Name",
        "Category",
        "Location",
        "Total Quantity",
        "Available Quantity",
        "Reserved Quantity",
        "Issued Quantity",
        "Damaged Quantity",
        "Low Stock Threshold",
        "Is Active",
        "Created At",
      ];

      const rows = ((data || []) as unknown as any[]).map((i) => [
        i.id,
        i.name,
        i.category?.name || "Uncategorized",
        i.location || "",
        i.total_quantity,
        i.available_quantity,
        i.reserved_quantity,
        i.issued_quantity,
        i.damaged_quantity,
        i.low_stock_threshold,
        i.is_active ? "Yes" : "No",
        formatDate(i.created_at),
      ]);

      const csvContent = buildCsv(headers, rows);
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="bazaar-items-${today}.csv"`,
        },
      });
    }

    // Default: requests
    const { data, error } = await supabase
      .from("bazaar_requests")
      .select("*, item:bazaar_items(name)")
      .order("created_at", { ascending: false });

    if (error) {
      const mapped = mapDbError(error);
      return jsonError(mapped.code, mapped.message, mapped.status);
    }

    const headers = [
      "Request ID",
      "Item Name",
      "Quantity",
      "Requester Name",
      "Reg Number",
      "Email",
      "Taking Date",
      "Expected Return Date",
      "Usage Location",
      "Location Details",
      "Purpose",
      "Project Name",
      "Status",
      "Decided By",
      "Decision Note",
      "Issued At",
      "Returned At",
      "Good Qty",
      "Damaged Qty",
      "Lost Qty",
      "Return Note",
      "Submitted At",
    ];

    const rows = ((data || []) as unknown as any[]).map((r) => [
      r.id,
      r.item?.name || "",
      r.quantity,
      r.member_name,
      r.member_reg_number || "",
      r.member_email || "",
      r.taking_date,
      r.expected_return_date,
      r.usage_location === "outside" ? "Outside Lab" : "Inside Lab",
      r.location_details || "",
      r.purpose,
      r.project_name || "",
      r.status,
      r.decided_by || "",
      r.decision_note || "",
      formatDate(r.issued_at),
      formatDate(r.returned_at),
      r.returned_good_qty ?? "",
      r.returned_damaged_qty ?? "",
      r.returned_lost_qty ?? "",
      r.return_note || "",
      formatDate(r.created_at),
    ]);

    const csvContent = buildCsv(headers, rows);
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bazaar-requests-${today}.csv"`,
      },
    });
  } catch (err: unknown) {
    if (err instanceof BazaarError) {
      return jsonError(err.code, err.message, err.status);
    }
    const message = (err as Error)?.message || "Internal server error";
    return jsonError("BAZAAR_INTERNAL", message, 500);
  }
}
