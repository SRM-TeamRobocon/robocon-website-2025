import { NextResponse } from "next/server";
import { getRegistrations } from "@/utils/googleSheets";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const event = searchParams.get("event") || undefined;

        // In a real app we would verify the JWT here too to ensure the API is protected 
        // even outside the middleware, but middleware handles it at the route level.

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
