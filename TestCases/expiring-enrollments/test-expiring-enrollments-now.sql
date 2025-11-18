-- ============================================================================
-- MANUALLY TEST EXPIRING ENROLLMENTS EMAIL FUNCTION
-- ============================================================================
-- This script manually triggers the check-expiring-enrollments function
-- Use this to test without waiting for the cron schedule
-- ============================================================================

-- First, let's verify our test data exists
SELECT
  pe.id AS enrollment_id,
  cm.name AS member_name,
  cp.name AS package_name,
  pe.start_date,
  pe.end_date,
  (pe.end_date - CURRENT_DATE) AS days_until_expiry,
  pe.is_active,
  tl.payment_status,
  tl.member_email,
  tl.receipt_number
FROM package_enrollments pe
JOIN club_members cm ON cm.id = pe.member_id
JOIN club_packages cp ON cp.id = pe.package_id
LEFT JOIN transaction_ledger tl ON tl.id = pe.package_transaction_id
WHERE pe.end_date = CURRENT_DATE + INTERVAL '3 days'
  AND pe.is_active = true
ORDER BY pe.end_date;

-- Show message about what we found
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM package_enrollments
  WHERE end_date = CURRENT_DATE + INTERVAL '3 days'
    AND is_active = true;

  RAISE NOTICE '';
  RAISE NOTICE '📊 Found % enrollment(s) expiring in 3 days', v_count;
  RAISE NOTICE '';

  IF v_count = 0 THEN
    RAISE NOTICE '⚠️  No enrollments found!';
    RAISE NOTICE '   Run create-test-expiring-enrollment.sql first';
  ELSE
    RAISE NOTICE '✅ Test data exists! Now triggering email function...';
    RAISE NOTICE '';
  END IF;
END $$;

-- ============================================================================
-- TRIGGER THE FUNCTION MANUALLY
-- ============================================================================
-- Uncomment ONE of the following based on your environment:

-- FOR LOCAL SUPABASE (Docker):
SELECT net.http_post(
  url := 'http://127.0.0.1:54321/functions/v1/check-expiring-enrollments',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"}'::jsonb,
  body := '{}'::jsonb
) AS request_id;

-- FOR CLOUD SUPABASE (Uncomment and update with your project details):
-- SELECT net.http_post(
--   url := 'https://YOUR-PROJECT-ID.supabase.co/functions/v1/check-expiring-enrollments',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR-SERVICE-ROLE-KEY"}'::jsonb,
--   body := '{}'::jsonb
-- ) AS request_id;

-- ============================================================================
-- ALTERNATIVE: Call via Supabase CLI (in terminal)
-- ============================================================================
-- If you prefer to use the Supabase CLI instead:
--
-- supabase functions invoke check-expiring-enrollments \
--   --env-file supabase/.env.local \
--   --no-verify-jwt
--
-- ============================================================================

-- Wait a moment, then check results
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '⏳ Email function triggered!';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Check the following:';
  RAISE NOTICE '   1. Supabase logs: supabase functions logs check-expiring-enrollments';
  RAISE NOTICE '   2. Email inbox: yousif.testing05@gmail.com';
  RAISE NOTICE '   3. Check payment_status in transaction to see if RECEIPT or INVOICE was sent';
  RAISE NOTICE '';
  RAISE NOTICE '💡 To change from INVOICE to RECEIPT (or vice versa):';
  RAISE NOTICE '   UPDATE transaction_ledger';
  RAISE NOTICE '   SET payment_status = ''paid''  -- or ''pending''';
  RAISE NOTICE '   WHERE member_email = ''yousif.testing05@gmail.com'';';
  RAISE NOTICE '';
END $$;
