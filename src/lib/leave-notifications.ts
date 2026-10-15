import { sendMemberPush } from "@/lib/attendance-push";
import { sendMemberNotificationEmail } from "@/lib/member-notification-email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface LeaveDetails {
    id: string;
    ownerName: string;
    startDate: string;
    endDate: string;
    reason: string;
    reviewNote?: string | null;
}

function leavePeriod(details: LeaveDetails) {
    return details.startDate === details.endDate
        ? details.startDate
        : `${details.startDate} to ${details.endDate}`;
}

export async function notifyAdminsOfLeaveRequest(details: LeaveDetails) {
    const supabase = createSupabaseAdminClient();
    const { data: admins, error } = await supabase
        .from("member_accounts")
        .select("id, name, email, google_email")
        .in("role", ["admin", "lead"])
        .eq("is_approved", true);

    if (error) {
        console.error("leave notification: admin lookup failed", error);
        return;
    }

    const message = `${details.ownerName} has requested leave for ${leavePeriod(details)}. Reason: ${details.reason}`;
    await Promise.all([
        Promise.all((admins || []).map((admin) => sendMemberPush(admin.id, {
            title: "New leave request",
            body: message,
            tag: `leave-request-${details.id}`,
            url: "/dashboard/leave-requests",
        }))),
        sendMemberNotificationEmail(
            (admins || []).flatMap((admin) => [admin.email, admin.google_email || ""]),
            "Team Admin",
            "New leave request",
            message
        ),
    ]);
}

export async function notifyMemberOfLeaveDecision(
    memberAccountId: string,
    details: LeaveDetails,
    decision: "approved" | "rejected"
) {
    const supabase = createSupabaseAdminClient();
    const { data: member, error } = await supabase
        .from("member_accounts")
        .select("id, name, email, google_email")
        .eq("id", memberAccountId)
        .maybeSingle();

    if (error || !member) {
        console.error("leave notification: member lookup failed", { memberAccountId, error });
        return;
    }

    const message = decision === "approved"
        ? `Your leave request for ${leavePeriod(details)} has been approved.`
        : `Your leave request for ${leavePeriod(details)} was rejected.${details.reviewNote ? ` Note: ${details.reviewNote}` : ""}`;

    await Promise.all([
        sendMemberPush(member.id, {
            title: decision === "approved" ? "Leave approved" : "Leave rejected",
            body: message,
            tag: `leave-${decision}-${details.id}`,
            url: "/dashboard/leave",
        }),
        sendMemberNotificationEmail(
            [member.email, member.google_email || ""],
            member.name,
            decision === "approved" ? "Leave request approved" : "Leave request rejected",
            message
        ),
    ]);
}
