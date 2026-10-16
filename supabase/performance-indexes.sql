-- Migration: Performance indexes for high-frequency queries
-- Applied directly on Supabase Postgres.

-- 1. content_edits pending moderation
CREATE INDEX IF NOT EXISTS content_edits_pending_idx 
ON content_edits (created_at DESC) 
WHERE status = 'pending';

-- 2. blogs pending moderation
CREATE INDEX IF NOT EXISTS blogs_pending_idx 
ON blogs (created_at DESC) 
WHERE status = 'pending';

-- 3. blogs public listing
CREATE INDEX IF NOT EXISTS blogs_public_published_idx 
ON blogs (published_at DESC) 
WHERE status = 'approved' AND visibility = 'public';

-- 4. leave_requests pending moderation
CREATE INDEX IF NOT EXISTS leave_requests_pending_idx 
ON leave_requests (created_at DESC) 
WHERE status = 'pending';

-- 5. attendance_logs occurred_at global ordering (cron and board scans)
CREATE INDEX IF NOT EXISTS attendance_logs_occurred_idx 
ON attendance_logs (occurred_at DESC);

-- 6. attendance_logs per-member latest log lookup (RFID tap & board status)
CREATE INDEX IF NOT EXISTS attendance_logs_member_action_idx 
ON attendance_logs (member_account_id, occurred_at DESC);

-- 7. contact_submissions admin listing
CREATE INDEX IF NOT EXISTS contact_submissions_submitted_idx 
ON contact_submissions (submitted_at DESC);
