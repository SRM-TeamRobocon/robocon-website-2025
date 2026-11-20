import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const VALID_SUPPORT_TYPES = ["Financial", "Technical", "Equipment", "Other"] as const;

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 15360) {
      return NextResponse.json(
        { error: "Payload exceeds size limit (max 15KB)" },
        { status: 413 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
    const companyWebsite = typeof body.companyWebsite === "string" ? body.companyWebsite.trim() : "";
    const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";
    const officialEmail = typeof body.officialEmail === "string" ? body.officialEmail.trim() : "";
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    const supportType = typeof body.supportType === "string" ? body.supportType.trim() : "";
    const partnershipDetails =
      typeof body.partnershipDetails === "string" ? body.partnershipDetails.trim() : "";
    const additionalMessage =
      typeof body.additionalMessage === "string" ? body.additionalMessage.trim() : "";

    // Required fields check
    if (!companyName) {
      return NextResponse.json({ error: "Company or Organization name is required" }, { status: 400 });
    }
    if (!contactName) {
      return NextResponse.json({ error: "Contact person name is required" }, { status: 400 });
    }
    if (!officialEmail) {
      return NextResponse.json({ error: "Official email address is required" }, { status: 400 });
    }
    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    if (!supportType || !VALID_SUPPORT_TYPES.includes(supportType as (typeof VALID_SUPPORT_TYPES)[number])) {
      return NextResponse.json(
        { error: "Please select a valid type of support (Financial, Technical, Equipment, Other)" },
        { status: 400 }
      );
    }
    if (!partnershipDetails) {
      return NextResponse.json(
        { error: "Sponsorship interest / partnership details are required" },
        { status: 400 }
      );
    }

    // Length checks
    if (
      companyName.length > 200 ||
      companyWebsite.length > 500 ||
      contactName.length > 100 ||
      officialEmail.length > 255 ||
      phoneNumber.length > 30 ||
      partnershipDetails.length > 4000 ||
      additionalMessage.length > 2000
    ) {
      return NextResponse.json(
        { error: "One or more inputs exceed maximum character limit" },
        { status: 400 }
      );
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(officialEmail)) {
      return NextResponse.json({ error: "Please provide a valid official email address" }, { status: 400 });
    }

    // Website format check (if provided)
    if (companyWebsite) {
      const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
      if (!urlRegex.test(companyWebsite)) {
        return NextResponse.json(
          { error: "Please enter a valid website URL (e.g., https://example.com)" },
          { status: 400 }
        );
      }
    }

    const formattedMessage = [
      "=== SPONSORSHIP ENQUIRY ===",
      `Company / Organization: ${companyName}`,
      `Company Website: ${companyWebsite || "Not provided"}`,
      `Contact Person: ${contactName}`,
      `Official Email: ${officialEmail}`,
      `Phone Number: ${phoneNumber}`,
      `Type of Support: ${supportType}`,
      "",
      "--- Partnership Details ---",
      partnershipDetails,
      "",
      "--- Additional Message ---",
      additionalMessage || "None",
    ].join("\n");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("contact_submissions").insert({
      name: `${contactName} (${companyName})`,
      email: officialEmail,
      message: formattedMessage,
    });

    if (error) {
      console.error("[Sponsors Enquiry] Database error:", error.message);
      return NextResponse.json(
        { error: "Failed to submit enquiry. Please try again or contact us directly." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Enquiry submitted successfully" },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[Sponsors Enquiry] Error:", message);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your enquiry." },
      { status: 500 }
    );
  }
}
