import { NextResponse } from "next/server";
import { getRegistrations } from "@/utils/googleSheets";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["lead", "admin"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const event = searchParams.get("event") || undefined;

        const registrations = await getRegistrations(event);

        return NextResponse.json({ success: true, data: registrations }, { status: 200 });
    } catch (error) {
        console.error("Error in registrations API:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
