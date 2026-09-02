import { google } from "googleapis";

// Session keys mapped to Google Sheet column letters (S–X)
export const SESSION_COLUMN_MAP: Record<string, string> = {
    day1Morning: "S",
    day1Evening: "T",
    day2Morning: "U",
    day2Evening: "V",
    day3Morning: "W",
    day3Evening: "X",
};

export type AttendanceSession = keyof typeof SESSION_COLUMN_MAP;

// Define the type for our registration rows based on the columns
export interface RegistrationRow {
    rowIndex: number; // To know exactly which row to update for check-ins
    name: string;
    regNumber: string;
    department: string;
    year: string;
    email: string;
    srmEmail: string;
    contact: string;
    whatsapp: string;
    hostel: string;
    room: string;
    workshop: string;
    paymentId: string;
    orderId: string;
    transactionId: string;
    paymentStatus: string;
    timestamp: string;
    ticketId: string;
    // Legacy single-column attendance (col R) - kept for backward compat
    attendance: string;
    // Per-session attendance (cols S–X)
    day1Morning: string;
    day1Evening: string;
    day2Morning: string;
    day2Evening: string;
    day3Morning: string;
    day3Evening: string;
}

// Ensure the private key is properly formatted
const getPrivateKey = () => {
    const pk = process.env.GOOGLE_PRIVATE_KEY || "";
    // Handle escaped newlines from env variables
    if (pk.includes("\\n")) {
        return pk.replace(/\\n/g, "\n");
    }
    return pk;
};

// Initialize the Google Auth Client
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: getPrivateKey(),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function getRegistrations(eventNameFilter?: string): Promise<RegistrationRow[]> {
    if (!SPREADSHEET_ID) {
        console.error("GOOGLE_SHEET_ID is not defined in environment variables");
        return [];
    }

    try {
        // Columns A–X:
        // A=Name, B=RegNum, C=Dept, D=Year, E=Email, F=SRMEmail, G=Contact, H=WhatsApp,
        // I=Hostel, J=Room, K=Workshop, L=PaymentID, M=OrderID, N=TransactionID,
        // O=PaymentStatus, P=Timestamp, Q=TicketID, R=Attendance(legacy),
        // S=Day1-Morning, T=Day1-Evening, U=Day2-Morning, V=Day2-Evening,
        // W=Day3-Morning, X=Day3-Evening
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Sheet1!A2:X", // Extended to column X
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return [];
        }

        const registrations: RegistrationRow[] = rows.map((row: string[], index: number) => ({
            // +2 because Sheet is 1-indexed and we skip the header row 1
            rowIndex: index + 2,
            name: row[0] || "",
            regNumber: row[1] || "",
            department: row[2] || "",
            year: row[3] || "",
            email: row[4] || "",
            srmEmail: row[5] || "",
            contact: row[6] || "",
            whatsapp: row[7] || "",
            hostel: row[8] || "",
            room: row[9] || "",
            workshop: row[10] || "",
            paymentId: row[11] || "",
            orderId: row[12] || "",
            transactionId: row[13] || "",
            paymentStatus: row[14] || "PENDING",
            timestamp: row[15] || "",
            ticketId: row[16] || "",
            attendance: row[17] || "ABSENT",    // col R (legacy)
            day1Morning: row[18] || "ABSENT",   // col S
            day1Evening: row[19] || "ABSENT",   // col T
            day2Morning: row[20] || "ABSENT",   // col U
            day2Evening: row[21] || "ABSENT",   // col V
            day3Morning: row[22] || "ABSENT",   // col W
            day3Evening: row[23] || "ABSENT",   // col X
        }));

        // Filter by event if provided (case insensitive)
        if (eventNameFilter) {
            return registrations.filter(
                (reg) => reg.workshop.toLowerCase() === eventNameFilter.toLowerCase()
            );
        }

        return registrations;
    } catch (error) {
        console.error("Error fetching registrations from Google Sheets:", error);
        return [];
    }
}

export async function updatePaymentStatus(rowIndex: number, status: "VERIFIED" | "PENDING" | "FAILED"): Promise<boolean> {
    if (!SPREADSHEET_ID) return false;

    try {
        // PaymentStatus is in Column O
        const range = `Sheet1!O${rowIndex}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[status]],
            },
        });

        return true;
    } catch (error) {
        console.error(`Error updating payment status for row ${rowIndex}:`, error);
        return false;
    }
}

export async function updateTicketId(rowIndex: number, ticketId: string): Promise<boolean> {
    if (!SPREADSHEET_ID) return false;

    try {
        // TicketID is in Column Q
        const range = `Sheet1!Q${rowIndex}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[ticketId]],
            },
        });

        return true;
    } catch (error) {
        console.error(`Error updating ticket ID for row ${rowIndex}:`, error);
        return false;
    }
}

/** Legacy - writes to column R. Kept for backward compatibility. */
export async function updateAttendanceStatus(rowIndex: number, status: "PRESENT" | "ABSENT"): Promise<boolean> {
    if (!SPREADSHEET_ID) return false;

    try {
        const range = `Sheet1!R${rowIndex}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[status]],
            },
        });

        return true;
    } catch (error) {
        console.error(`Error updating attendance status for row ${rowIndex}:`, error);
        return false;
    }
}

/**
 * Write attendance for a specific session into the corresponding column (S–X).
 * @param rowIndex  1-based sheet row number
 * @param session   One of the SESSION_COLUMN_MAP keys
 * @param status    "PRESENT" | "ABSENT"
 */
export async function updateSessionAttendance(
    rowIndex: number,
    session: AttendanceSession,
    status: "PRESENT" | "ABSENT"
): Promise<boolean> {
    if (!SPREADSHEET_ID) return false;

    const col = SESSION_COLUMN_MAP[session];
    if (!col) {
        console.error(`Unknown session key: ${session}`);
        return false;
    }

    try {
        const range = `Sheet1!${col}${rowIndex}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[status]],
            },
        });

        return true;
    } catch (error) {
        console.error(`Error updating session attendance (${session}) for row ${rowIndex}:`, error);
        return false;
    }
}
