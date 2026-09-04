import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by every route under src/app/api/admin/recruitment/send-mail/* - job creation,
// chunk processing, preview and test-send all need the same bounds and the same
// event-label formatting so a preview always matches what actually goes out.

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 5000;
export const MAX_TEMPLATE_NAME_LENGTH = 100;

// Bounds a single job to roughly one active cycle's worth of recruits. Larger blasts should
// be sent as a few filtered jobs rather than one job that takes an unreasonable number of
// chunk-processing round trips to drain.
export const MAX_RECIPIENTS = 3000;

// A plain Gmail account caps recipients (to+cc+bcc) at ~500 per message. Recipients are
// batched into BCC-only sends of this size - no personalization, everyone in a chunk gets
// the identical email, so this is purely a Gmail-limit workaround, not a per-recruit send.
export const BCC_CHUNK_SIZE = 450;

export function formatEventLabel(eventAt: Date | null): string | null {
  return eventAt
    ? eventAt.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" })
    : null;
}

export interface JobProgress {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

// A recruit can appear in more than one recipient row (srm_email + personal_email), so
// "sent"/"failed" is resolved per recruit_id across all their rows, not per row: a recruit
// counts as sent if ANY of their addresses went through, and as failed only if NONE did and
// at least one was attempted. This mirrors the pre-migration in-memory logic in
// send-mail/route.ts, just persisted instead of computed once and discarded.
export async function getJobProgress(supabase: SupabaseClient, jobId: string): Promise<JobProgress> {
  const { data: rows } = await supabase
    .from("recruit_bulk_mail_recipients")
    .select("recruit_ids, status")
    .eq("job_id", jobId);

  const statusesByRecruit = new Map<string, Set<string>>();
  for (const row of (rows ?? []) as { recruit_ids: string[]; status: string }[]) {
    for (const recruitId of row.recruit_ids) {
      if (!statusesByRecruit.has(recruitId)) statusesByRecruit.set(recruitId, new Set());
      statusesByRecruit.get(recruitId)!.add(row.status);
    }
  }

  let sent = 0;
  let failed = 0;
  let pending = 0;
  statusesByRecruit.forEach((statuses) => {
    if (statuses.has("sent")) sent++;
    else if (statuses.has("failed")) failed++;
    else pending++;
  });

  return { total: statusesByRecruit.size, sent, failed, pending };
}
