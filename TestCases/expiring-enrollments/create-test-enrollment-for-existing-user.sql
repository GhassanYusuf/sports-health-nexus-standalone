-- ============================================================================
-- CREATE TEST ENROLLMENT FOR EXISTING USER
-- ============================================================================
-- Run this AFTER creating user: yousif.testing05@gmail.com
-- This creates an enrollment expiring in 3 days for testing
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_club_id UUID;
  v_member_id UUID;
  v_package_id UUID;
  v_package_price_version_id UUID;
  v_enrollment_transaction_id UUID;
  v_package_transaction_id UUID;
  v_start_date DATE;
  v_end_date DATE;
  v_receipt_number TEXT;
BEGIN
  -- Set dates: package expires in 3 days
  v_start_date := CURRENT_DATE - INTERVAL '27 days';
  v_end_date := CURRENT_DATE + INTERVAL '3 days';

  -- Find the user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'yousif.testing05@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ User not found! Please create user yousif.testing05@gmail.com first';
  END IF;

  RAISE NOTICE '✅ Found user ID: %', v_user_id;

  -- Get first club
  SELECT id INTO v_club_id FROM clubs LIMIT 1;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION '❌ No clubs found. Please create a club first.';
  END IF;

  RAISE NOTICE '✅ Using club_id: %', v_club_id;

  -- Get a monthly package
  SELECT id INTO v_package_id
  FROM club_packages
  WHERE club_id = v_club_id
    AND duration_months = 1
  LIMIT 1;

  -- Set price version to NULL (no price history exists)
  v_package_price_version_id := NULL;

  IF v_package_id IS NULL THEN
    RAISE EXCEPTION '❌ No monthly packages found for this club.';
  END IF;

  RAISE NOTICE '✅ Using package_id: %', v_package_id;

  -- Skip profile creation - user signup should have created it
  -- We only need the club_member record
  RAISE NOTICE '✅ Skipping profile (should exist from signup)';

  -- Delete old test enrollments for this user (cleanup)
  DELETE FROM public.package_enrollments
  WHERE member_id IN (
    SELECT id FROM club_members WHERE user_id = v_user_id
  );

  -- Delete old test members for this user
  DELETE FROM public.club_members
  WHERE user_id = v_user_id AND club_id = v_club_id;

  RAISE NOTICE '✅ Cleaned up old test data';

  -- Create club member
  INSERT INTO public.club_members (
    id,
    club_id,
    user_id,
    name,
    rank,
    is_active,
    joined_date,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    v_club_id,
    v_user_id,
    'Yousif Test User',
    'White Belt',
    TRUE,
    v_start_date,
    NOW()
  )
  RETURNING id INTO v_member_id;

  RAISE NOTICE '✅ Created member ID: %', v_member_id;

  -- Generate receipt number
  SELECT generate_receipt_number(v_club_id) INTO v_receipt_number;

  -- Create ENROLLMENT FEE transaction (PAID)
  INSERT INTO public.transaction_ledger (
    id,
    club_id,
    member_id,
    transaction_type,
    category,
    description,
    amount,
    vat_amount,
    vat_percentage_applied,
    total_amount,
    payment_method,
    payment_status,
    receipt_number,
    transaction_date,
    member_name,
    member_email,
    member_phone,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    v_club_id,
    v_member_id,
    'enrollment_fee',
    NULL,
    'Enrollment Fee - Yousif Test User',
    10.000,
    0.500,
    5.00,
    10.500,
    'cash',
    'paid',
    v_receipt_number,
    v_start_date,
    'Yousif Test User',
    'yousif.testing05@gmail.com',
    '+973 12345678',
    NOW()
  )
  RETURNING id INTO v_enrollment_transaction_id;

  RAISE NOTICE '✅ Created enrollment transaction: %', v_enrollment_transaction_id;

  -- Generate receipt number for package
  SELECT generate_receipt_number(v_club_id) INTO v_receipt_number;

  -- Create PACKAGE FEE transaction (PENDING - will send INVOICE)
  INSERT INTO public.transaction_ledger (
    id,
    club_id,
    member_id,
    package_price_version_id,
    transaction_type,
    category,
    description,
    amount,
    vat_amount,
    vat_percentage_applied,
    total_amount,
    payment_method,
    payment_status,
    receipt_number,
    transaction_date,
    member_name,
    member_email,
    member_phone,
    created_at
  )
  SELECT
    gen_random_uuid(),
    v_club_id,
    v_member_id,
    v_package_price_version_id,
    'package_fee',
    NULL,
    'Monthly Package Fee - ' || pkg.name,
    pkg.price,
    pkg.price * 0.05,
    5.00,
    pkg.price * 1.05,
    'cash',
    'pending',
    v_receipt_number,
    v_start_date,
    'Yousif Test User',
    'yousif.testing05@gmail.com',
    '+973 12345678',
    NOW()
  FROM club_packages pkg
  WHERE pkg.id = v_package_id
  RETURNING id INTO v_package_transaction_id;

  RAISE NOTICE '✅ Created package transaction: %', v_package_transaction_id;

  -- Create package enrollment (EXPIRES IN 3 DAYS!)
  INSERT INTO public.package_enrollments (
    id,
    member_id,
    package_id,
    package_price_version_id,
    enrollment_transaction_id,
    package_transaction_id,
    is_active,
    enrolled_at,
    start_date,
    end_date,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    v_member_id,
    v_package_id,
    v_package_price_version_id,
    v_enrollment_transaction_id,
    v_package_transaction_id,
    TRUE,
    v_start_date,
    v_start_date,
    v_end_date,
    NOW()
  );

  RAISE NOTICE '';
  RAISE NOTICE '🎉 ========================================';
  RAISE NOTICE '🎉 SUCCESS! Test enrollment created';
  RAISE NOTICE '🎉 ========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Email: yousif.testing05@gmail.com';
  RAISE NOTICE '📅 Start Date: %', v_start_date;
  RAISE NOTICE '⏰ End Date: % (EXPIRES IN 3 DAYS!)', v_end_date;
  RAISE NOTICE '💳 Payment Status: PENDING (will send INVOICE)';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 To test RECEIPT instead of INVOICE:';
  RAISE NOTICE '   UPDATE transaction_ledger';
  RAISE NOTICE '   SET payment_status = ''paid''';
  RAISE NOTICE '   WHERE id = ''%'';', v_package_transaction_id;
  RAISE NOTICE '';
  RAISE NOTICE '▶️  Next step: Deploy and test the function!';
  RAISE NOTICE '   supabase functions deploy check-expiring-enrollments';
  RAISE NOTICE '';

END $$;
