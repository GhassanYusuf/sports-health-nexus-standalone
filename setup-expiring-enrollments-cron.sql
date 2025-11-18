-- ============================================================================
-- SETUP CRON JOB FOR EXPIRING ENROLLMENTS EMAIL NOTIFICATIONS
-- ============================================================================
-- This sets up automated checks for package enrollments expiring in 3 days
-- Runs at 10:00 AM daily to send emails
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions to use cron (if needed)
-- GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove old cron job if exists (for clean setup)
SELECT cron.unschedule('check-expiring-enrollments-10am')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-expiring-enrollments-10am'
);

-- ============================================================================
-- CRON JOB: Check and send emails for expiring enrollments
-- Schedule: Every day at 10:00 AM
-- ============================================================================
SELECT cron.schedule(
  'check-expiring-enrollments-10am',
  '0 10 * * *',  -- Cron expression: minute=0, hour=10 (10:00 AM), every day
  $$
  SELECT net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/check-expiring-enrollments',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- View scheduled cron jobs
-- ============================================================================
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'check-expiring-enrollments-10am';

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. The cron runs at 10:00 AM every day
-- 2. It checks for enrollments expiring in exactly 3 days
-- 3. Sends INVOICE if package payment is pending/failed
-- 4. Sends RECEIPT if package payment is paid
--
-- To manually trigger the function for testing:
--   SELECT net.http_post(...) -- see test-expiring-enrollments-now.sql
--
-- To disable the cron job:
--   SELECT cron.unschedule('check-expiring-enrollments-10am');
--
-- To view cron job history/logs:
--   SELECT * FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-expiring-enrollments-10am')
--   ORDER BY start_time DESC
--   LIMIT 10;
-- ============================================================================

-- Show success message
DO $$
BEGIN
  RAISE NOTICE '✅ Cron job setup complete!';
  RAISE NOTICE '   Job name: check-expiring-enrollments-10am';
  RAISE NOTICE '   Schedule: Every day at 10:00 AM';
  RAISE NOTICE '   Action: Check enrollments expiring in 3 days and send emails';
  RAISE NOTICE '';
  RAISE NOTICE '💡 To test manually, run: psql -f test-expiring-enrollments-now.sql';
END $$;
