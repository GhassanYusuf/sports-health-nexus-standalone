-- ============================================================================
-- CREATE TEST DATA FOR EXPIRING PACKAGE ENROLLMENT
-- ============================================================================
-- This creates a test user with an enrollment expiring in 3 days
-- Email: yousif.testing05@gmail.com
-- ============================================================================

-- Calculate dates
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
  v_start_date := CURRENT_DATE - INTERVAL '27 days'; -- Started 27 days ago (assuming 1 month package)
  v_end_date := CURRENT_DATE + INTERVAL '3 days';    -- Expires in 3 days

  -- Get first club (or you can specify a specific club_id)
  SELECT id INTO v_club_id FROM clubs LIMIT 1;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'No clubs found. Please create a club first.';
  END IF;

  RAISE NOTICE 'Using club_id: %', v_club_id;

  -- Get a package from the club (preferably a 1-month package)
  SELECT id, id AS price_version_id
  INTO v_package_id, v_package_price_version_id
  FROM club_packages
  WHERE club_id = v_club_id
    AND duration_months = 1
  LIMIT 1;

  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'No monthly packages found for this club. Please create a package first.';
  END IF;

  RAISE NOTICE 'Using package_id: %', v_package_id;

  -- 1. Create auth user (if doesn't exist)
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'yousif.testing05@gmail.com',
    crypt('TestPassword123!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Yousif Test User"}',
    FALSE,
    '',
    '',
    ''
  )
  ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_user_id;

  RAISE NOTICE 'User ID: %', v_user_id;

  -- 2. Create profile (if doesn't exist)
  INSERT INTO public.profiles (
    user_id,
    email,
    full_name,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    'yousif.testing05@gmail.com',
    'Yousif Test User',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = 'yousif.testing05@gmail.com',
    full_name = 'Yousif Test User',
    updated_at = NOW();

  -- 3. Create club member
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

  RAISE NOTICE 'Member ID: %', v_member_id;

  -- 4. Generate receipt number for enrollment fee
  SELECT generate_receipt_number(v_club_id) INTO v_receipt_number;

  -- 5. Create ENROLLMENT FEE transaction (PAID - for testing paid scenario)
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
    'Enrollment',
    'Enrollment Fee - Yousif Test User',
    10.000,  -- 10 BHD enrollment fee
    0.500,   -- 5% VAT = 0.5 BHD
    5.00,    -- 5% VAT percentage
    10.500,  -- Total: 10.5 BHD
    'cash',
    'paid',  -- PAID - so it should send RECEIPT
    v_receipt_number,
    v_start_date,
    'Yousif Test User',
    'yousif.testing05@gmail.com',
    '+973 12345678',
    NOW()
  )
  RETURNING id INTO v_enrollment_transaction_id;

  RAISE NOTICE 'Enrollment Transaction ID: %', v_enrollment_transaction_id;

  -- 6. Generate receipt number for package fee
  SELECT generate_receipt_number(v_club_id) INTO v_receipt_number;

  -- 7. Create PACKAGE FEE transaction (PENDING - for testing unpaid scenario)
  -- Change payment_status to 'pending' if you want to test invoice sending
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
    'Package Fee',
    'Monthly Package Fee - ' || pkg.name,
    pkg.price,
    pkg.price * 0.05,  -- 5% VAT
    5.00,
    pkg.price * 1.05,  -- Total with VAT
    'cash',
    'pending',  -- PENDING - so it should send INVOICE (change to 'paid' for RECEIPT)
    v_receipt_number,
    v_start_date,
    'Yousif Test User',
    'yousif.testing05@gmail.com',
    '+973 12345678',
    NOW()
  FROM club_packages pkg
  WHERE pkg.id = v_package_id
  RETURNING id INTO v_package_transaction_id;

  RAISE NOTICE 'Package Transaction ID: %', v_package_transaction_id;

  -- 8. Create package enrollment with dates set to expire in 3 days
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
    v_end_date,  -- Expires in 3 days!
    NOW()
  );

  RAISE NOTICE '✅ SUCCESS! Test enrollment created:';
  RAISE NOTICE '   - Email: yousif.testing05@gmail.com';
  RAISE NOTICE '   - Start Date: %', v_start_date;
  RAISE NOTICE '   - End Date (expires in 3 days): %', v_end_date;
  RAISE NOTICE '   - Enrollment Transaction: % (PAID)', v_enrollment_transaction_id;
  RAISE NOTICE '   - Package Transaction: % (PENDING - will send INVOICE)', v_package_transaction_id;
  RAISE NOTICE '';
  RAISE NOTICE '💡 To test RECEIPT instead of INVOICE:';
  RAISE NOTICE '   UPDATE transaction_ledger SET payment_status = ''paid'' WHERE id = ''%'';', v_package_transaction_id;

END $$;
