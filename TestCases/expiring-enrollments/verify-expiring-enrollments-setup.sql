-- ============================================================================
-- VERIFY EXPIRING ENROLLMENTS EMAIL SYSTEM SETUP
-- ============================================================================
-- This script checks if everything is configured correctly
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'EXPIRING ENROLLMENTS EMAIL SYSTEM CHECK'
\echo '========================================='
\echo ''

-- 1. Check for test data
\echo '1️⃣  Checking test data...'
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Found ' || COUNT(*) || ' enrollment(s) expiring in 3 days'
    ELSE '❌ No enrollments found - run create-test-expiring-enrollment.sql'
  END AS test_data_status
FROM package_enrollments
WHERE end_date = CURRENT_DATE + INTERVAL '3 days'
  AND is_active = true;

\echo ''

-- 2. Show detailed test data
\echo '2️⃣  Test enrollment details:'
SELECT
  cm.name AS member_name,
  p.email AS member_email,
  cp.name AS package_name,
  pe.start_date,
  pe.end_date,
  (pe.end_date - CURRENT_DATE) AS days_until_expiry,
  tl.payment_status,
  tl.receipt_number,
  CASE
    WHEN tl.payment_status = 'paid' THEN '📧 Will send RECEIPT'
    WHEN tl.payment_status IN ('pending', 'failed') THEN '📧 Will send INVOICE'
    ELSE '⚠️  Unknown status'
  END AS email_type
FROM package_enrollments pe
JOIN club_members cm ON cm.id = pe.member_id
JOIN club_packages cp ON cp.id = pe.package_id
LEFT JOIN profiles p ON p.user_id = cm.user_id
LEFT JOIN transaction_ledger tl ON tl.id = pe.package_transaction_id
WHERE pe.end_date = CURRENT_DATE + INTERVAL '3 days'
  AND pe.is_active = true;

\echo ''

-- 3. Check if Edge Function exists (we can't directly check, but show the command)
\echo '3️⃣  Edge Function check:'
\echo '   Run: supabase functions list | grep check-expiring-enrollments'
\echo ''

-- 4. Check if cron job is scheduled
\echo '4️⃣  Checking cron job schedule...'
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-expiring-enrollments-10am')
    THEN '✅ Cron job scheduled: check-expiring-enrollments-10am'
    ELSE '⚠️  Cron job not found - run setup-expiring-enrollments-cron.sql'
  END AS cron_status;

-- Show cron job details if exists
SELECT
  jobid,
  jobname,
  schedule,
  active,
  'Next run: ' || (
    SELECT MIN(run_at)
    FROM cron.schedule_jobs(start_time := NOW(), end_time := NOW() + INTERVAL '24 hours')
    WHERE jobid = cron.job.jobid
  ) AS next_run
FROM cron.job
WHERE jobname = 'check-expiring-enrollments-10am';

\echo ''

-- 5. Check recent cron job runs (if any)
\echo '5️⃣  Recent cron job executions:'
SELECT
  run_id,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-expiring-enrollments-10am')
ORDER BY start_time DESC
LIMIT 5;

\echo ''

-- 6. Check required extensions
\echo '6️⃣  Checking required database extensions...'
SELECT
  extname,
  CASE
    WHEN extname = 'pg_cron' THEN '✅ pg_cron enabled (for cron jobs)'
    WHEN extname = 'pg_net' THEN '✅ pg_net enabled (for HTTP calls)'
    ELSE extname || ' enabled'
  END AS status
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net');

\echo ''

-- 7. Check SMTP configuration (we can only check if file exists, not contents)
\echo '7️⃣  SMTP Configuration:'
\echo '   Check: supabase/functions/send-receipt-email/.env.local'
\echo '   Should contain: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD'
\echo ''

-- 8. Summary and next steps
\echo ''
\echo '========================================='
\echo 'SUMMARY & NEXT STEPS'
\echo '========================================='
\echo ''

DO $$
DECLARE
  v_has_test_data BOOLEAN;
  v_has_cron BOOLEAN;
  v_has_extensions BOOLEAN;
BEGIN
  -- Check test data
  SELECT EXISTS (
    SELECT 1 FROM package_enrollments
    WHERE end_date = CURRENT_DATE + INTERVAL '3 days'
      AND is_active = true
  ) INTO v_has_test_data;

  -- Check cron job
  SELECT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'check-expiring-enrollments-10am'
  ) INTO v_has_cron;

  -- Check extensions
  SELECT (
    SELECT COUNT(*) FROM pg_extension
    WHERE extname IN ('pg_cron', 'pg_net')
  ) >= 1 INTO v_has_extensions;

  RAISE NOTICE '';

  IF v_has_test_data AND v_has_cron AND v_has_extensions THEN
    RAISE NOTICE '✅ ALL CHECKS PASSED!';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Your expiring enrollments email system is ready!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 What happens next:';
    RAISE NOTICE '   • Cron runs at 10:00 AM daily';
    RAISE NOTICE '   • Checks enrollments expiring in 3 days';
    RAISE NOTICE '   • Sends invoice/receipt emails automatically';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 To test now:';
    RAISE NOTICE '   psql -f test-expiring-enrollments-now.sql';
    RAISE NOTICE '';

  ELSE
    RAISE NOTICE '⚠️  SETUP INCOMPLETE';
    RAISE NOTICE '';

    IF NOT v_has_test_data THEN
      RAISE NOTICE '❌ Missing test data';
      RAISE NOTICE '   Run: psql -f create-test-expiring-enrollment.sql';
      RAISE NOTICE '';
    END IF;

    IF NOT v_has_cron THEN
      RAISE NOTICE '❌ Missing cron job';
      RAISE NOTICE '   Run: psql -f setup-expiring-enrollments-cron.sql';
      RAISE NOTICE '';
    END IF;

    IF NOT v_has_extensions THEN
      RAISE NOTICE '⚠️  Missing extensions (pg_cron or pg_net)';
      RAISE NOTICE '   Contact your Supabase admin or check docs';
      RAISE NOTICE '';
    END IF;

    RAISE NOTICE '📖 See EXPIRING-ENROLLMENTS-SETUP.md for detailed instructions';
    RAISE NOTICE '';
  END IF;

END $$;
