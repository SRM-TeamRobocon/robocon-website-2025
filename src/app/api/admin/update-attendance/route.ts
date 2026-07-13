import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import { updateSessionAttendance, AttendanceSession, SESSION_COLUMN_MAP } from "@/utils/googleSheets";

export const dynamic = "force-dynamic";

const VALID_SESSIONS = Object.keys(SESSION_COLUMN_MAP) as AttendanceSession[];

export async function POST(request: Request) {
    try {
        // Enforce Lead Role
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token")?.value;
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_robocon_2026_!@#');

        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { payload } = await jose.jwtVerify(token, secret);
        if (payload.role !== "lead" && payload.role !== "admin") {
            return NextResponse.json({ success: false, error: "Lead account required to manually update attendance" }, { status: 403 });
        }

        const body = await request.json();
        const { rowIndex, session, status } = body;

        // Validation
        if (!rowIndex || !session || !status) {
            return NextResponse.json(
                { success: false, error: "Missing required fields (rowIndex, session, status)" },
                { status: 400 }
            );
        }

        if (!VALID_SESSIONS.includes(session)) {
            return NextResponse.json(
                { success: false, error: `Invalid session. Must be one of: ${VALID_SESSIONS.join(", ")}` },
                { status: 400 }
            );
        }

        if (status !== "PRESENT" && status !== "ABSENT") {
            return NextResponse.json(
                { success: false, error: "Status must be 'PRESENT' or 'ABSENT'" },
                { status: 400 }
            );
        }

        // Write directly to the corresponding column via Google Sheets API
        const updated = await updateSessionAttendance(rowIndex, session, status);

        if (!updated) {
            return NextResponse.json(
                { success: false, error: "Failed to update Google Sheets" },
                { status: 500 }
            );
        }

        return NextResponse.json({ 
            success: true, 
            message: `Attendance marked ${status} for the session.` 
        }, { status: 200 });

    } catch (error) {
        console.error("Error in update-attendance API:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
