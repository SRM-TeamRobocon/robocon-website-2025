import { NextResponse } from "next/server";
import { updateAttendanceStatus, getRegistrations } from "@/utils/googleSheets";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ticketId, eventName } = body;

        if (!ticketId) {
            return NextResponse.json(
                { success: false, error: "Missing ticket ID" },
                { status: 400 }
            );
        }

        // Let's fetch all registrations WITHOUT filtering by event first
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

        const match = ticketRecord;

        if (match.attendance === "PRESENT") {
            return NextResponse.json({ success: false, error: "Ticket has already been used!" }, { status: 200 });
        }

        // Update Attendance (Column R)
        const updated = await updateAttendanceStatus(match.rowIndex, "PRESENT");

        if (updated) {
            return NextResponse.json({
                success: true,
                message: `Successfully checked in ${match.name}!`
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
