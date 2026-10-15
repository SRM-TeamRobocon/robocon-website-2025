import type { SupabaseClient } from "@supabase/supabase-js";

export type ApprovalHistoryType = "member" | "content" | "blog" | "leave";

export async function recordApproval(
    supabase: SupabaseClient,
    entry: {
        approvalType: ApprovalHistoryType;
        subjectId: string;
        subjectLabel: string;
        decision: "approved" | "rejected";
        approvedBy: string;
        approvedByName?: string | null;
        approvedAt?: string;
    }
) {
    const { error } = await supabase.from("approval_history").insert({
        approval_type: entry.approvalType,
        subject_id: entry.subjectId,
        subject_label: entry.subjectLabel,
        decision: entry.decision,
        approved_by: entry.approvedBy,
        approved_by_name: entry.approvedByName || null,
        approved_at: entry.approvedAt || new Date().toISOString(),
    });

    if (error) {
        console.error("approval history record error", error);
        throw new Error("Could not record approval history.");
    }
}
