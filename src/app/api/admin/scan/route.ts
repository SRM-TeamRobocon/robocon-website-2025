import { NextResponse } from "next/server";
import { updateSessionAttendance, getRegistrations, SESSION_COLUMN_MAP, AttendanceSession } from "@/utils/googleSheets";
import { getSession, requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const VALID_SESSIONS = Object.keys(SESSION_COLUMN_MAP) as AttendanceSession[];

export async function POST(request: Request) {
    try {
        const authSession = await getSession();
        if (!requireRole(authSession, ["lead", "admin"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { ticketId, eventName, session } = body;

        if (!ticketId) {
            return NextResponse.json(
                { success: false, error: "Missing ticket ID" },
                { status: 400 }
            );
        }

        if (!session || !VALID_SESSIONS.includes(session)) {
            return NextResponse.json(
                { success: false, error: `Missing or invalid session. Must be one of: ${VALID_SESSIONS.join(", ")}` },
                { status: 400 }
            );
        }

        // Fetch all registrations (unfiltered)
        const allRegistrations = await getRegistrations();

        const ticketRecord = allRegistrations.find(r => r.ticketId === ticketId);

        if (!ticketRecord) {
            return NextResponse.json({ success: false, error: "Invalid Ticket ID. Not found in records." }, { status: 404 });
        }

        if (ticketRecord.paymentStatus !== "VERIFIED") {
            return NextResponse.json({ success: false, error: "Ticket is PENDING payment verification." }, { status: 400 });
        }

        // Check if the ticket's workshop matches the event they're scanning for
        if (ticketRecord.workshop.trim().toLowerCase() !== eventName.trim().toLowerCase()) {
            return NextResponse.json({
                success: false,
                error: `Wrong Event! This ticket is for the ${ticketRecord.workshop} workshop, not ${eventName}.`
            }, { status: 400 });
        }

        // Check if already checked in for THIS specific session
        const sessionValue = ticketRecord[session as keyof typeof ticketRecord] as string;
        if (sessionValue === "PRESENT") {
            return NextResponse.json({
                success: false,
                error: `${ticketRecord.name} is already checked in for this session!`
            }, { status: 200 });
        }

        // Update session attendance
        const updated = await updateSessionAttendance(ticketRecord.rowIndex, session, "PRESENT");

        if (updated) {
            return NextResponse.json({
                success: true,
                message: `Successfully checked in ${ticketRecord.name}!`
            }, { status: 200 });
        } else {
            return NextResponse.json({ success: false, error: "Failed to write to Google Sheets" }, { status: 500 });
        }

    } catch (error) {
        console.error("Error in scan API:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
