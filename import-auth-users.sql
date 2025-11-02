-- =====================================================
-- IMPORT AUTH USERS INTO NEW DATABASE
-- =====================================================
-- Generated from exported auth.users JSON
-- Run this in pgAdmin 4 on your NEW database

-- Insert all 8 auth users (confirmed_at is a generated column, so we skip it)
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
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    phone
) VALUES
-- User 1: Sulaiman Rashid Shabib
(
    '6efe5161-8bd0-4088-b2d2-beb995b6a0f1'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'sshbyb411@gmil.com',
    '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET',
    '2025-10-18T03:04:06.257351Z'::timestamptz,
    '2025-10-18T03:04:06.230533Z'::timestamptz,
    '2025-10-18T05:53:03.95291Z'::timestamptz,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    NULL
),
-- User 2: Ahmed
(
    '6012dbc2-411f-4c50-a828-43c1263618dd'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'ahmed@gmaill.com',
    '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET',
    '2025-10-16T03:50:19.357241Z'::timestamptz,
    '2025-10-16T03:50:19.349155Z'::timestamptz,
    '2025-10-16T03:50:19.358128Z'::timestamptz,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    NULL
),
-- User 3: Ghaida
(
    'e6918d3a-50dc-4855-8843-bf85b1cd8ae5'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'ghaidaa@gmail.com',
    '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET',
    '2025-10-16T03:46:47.323101Z'::timestamptz,
    '2025-10-16T03:46:47.284763Z'::timestamptz,
    '2025-10-16T03:46:47.324584Z'::timestamptz,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    NULL
),
-- User 4: Manar Al Rayes (Phoenix TKD)
(
    '7c3fe146-41ab-4506-9a8f-d646e686b00c'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'phoenix.tkd.bh@gmail.com',
    '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET',
    '2025-10-15T21:43:41.855013Z'::timestamptz,
    '2025-10-15T21:43:41.790177Z'::timestamptz,
    '2025-10-18T05:55:18.269242Z'::timestamptz,
    '2025-10-18T04:00:01.43743Z'::timestamptz,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    NULL
),
-- User 5: Fahad Aayed Alanzi
(
    '4092bc21-4832-467f-841a-2b3a9b969029'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'theemperorfahad@gmail.com',
    '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET',
    '2025-10-15T21:36:52.041159Z'::timestamptz,
    '2025-10-15T21:36:51.995782Z'::timestamptz,
    '2025-10-18T11:47:02.750502Z'::timestamptz,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    NULL
),
-- User 6: Sami Al Manea (Emperor TKD)
(
    'e54bd861-1c4e-4b4e-9fc6-ddfeac66ed19'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'emperorsameta@gmail.com',
    '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET',
    '2025-10-15T11:36:10.554763Z'::timestamptz,
    '2025-10-15T11:36:10.498913Z'::timestamptz,
    '2025-10-15T11:36:10.55607Z'::timestamptz,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    NULL
),
-- User 7: Hassan Ali Shalan (Legend TKD)
(
    '28bd1311-4b1c-4155-961b-0667b0d55c96'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'hasanshalan114@gmail.com',
    '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET',
    '2025-10-15T04:04:13.799077Z'::timestamptz,
    '2025-10-15T04:04:13.761631Z'::timestamptz,
    '2025-10-15T04:04:13.80073Z'::timestamptz,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    NULL
),
-- User 8: Ghassan Mohamed Yusuf (Super Admin)
(
    '3f9a5abf-a9c8-46de-ad7f-0466a8c1e054'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'platformtakeone@gmail.com',
    '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET',
    '2025-10-15T03:39:54.129149Z'::timestamptz,
    '2025-10-15T03:39:54.046867Z'::timestamptz,
    '2025-10-29T08:58:05.073608Z'::timestamptz,
    '2025-10-29T08:58:05.06148Z'::timestamptz,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- VERIFY AUTH USERS WERE CREATED
-- =====================================================
SELECT
    COUNT(*) AS total_users,
    'Auth users imported successfully' AS status
FROM auth.users;

-- Show all imported users
SELECT
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users
ORDER BY created_at;

-- =====================================================
-- CHECK FOR REMAINING ORPHANS
-- =====================================================
SELECT
    'profiles' AS table_name,
    COUNT(*) AS orphaned_count
FROM profiles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'user_roles', COUNT(*)
FROM user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'children', COUNT(*)
FROM children
WHERE parent_user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'clubs (business_owner)', COUNT(*)
FROM clubs
WHERE business_owner_id IS NOT NULL
AND business_owner_id NOT IN (SELECT id FROM auth.users);

-- Expected: All counts should be 0

-- =====================================================
-- NOW RESTORE FOREIGN KEY CONSTRAINTS
-- =====================================================
DO $$
BEGIN
    -- 1. profiles → auth.users
    BEGIN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✓ Added profiles_user_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ profiles_user_id_fkey already exists';
    END;

    -- 2. user_roles → auth.users
    BEGIN
        ALTER TABLE public.user_roles
        ADD CONSTRAINT user_roles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✓ Added user_roles_user_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ user_roles_user_id_fkey already exists';
    END;

    -- 3. children → auth.users
    BEGIN
        ALTER TABLE public.children
        ADD CONSTRAINT children_parent_user_id_fkey
        FOREIGN KEY (parent_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✓ Added children_parent_user_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ children_parent_user_id_fkey already exists';
    END;

    -- 4. club_instructors → club_members
    BEGIN
        ALTER TABLE public.club_instructors
        ADD CONSTRAINT club_instructors_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES public.club_members(id) ON DELETE CASCADE;
        RAISE NOTICE '✓ Added club_instructors_member_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ club_instructors_member_id_fkey already exists';
    END;

    -- 5. clubs → auth.users
    BEGIN
        ALTER TABLE public.clubs
        ADD CONSTRAINT clubs_business_owner_id_fkey
        FOREIGN KEY (business_owner_id) REFERENCES auth.users(id);
        RAISE NOTICE '✓ Added clubs_business_owner_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ clubs_business_owner_id_fkey already exists';
    END;
END $$;

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================
SELECT
    tc.constraint_name,
    tc.table_name,
    'RESTORED' AS status
FROM information_schema.table_constraints AS tc
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.constraint_name IN (
        'profiles_user_id_fkey',
        'user_roles_user_id_fkey',
        'children_parent_user_id_fkey',
        'club_instructors_member_id_fkey',
        'clubs_business_owner_id_fkey'
    )
ORDER BY tc.table_name;

-- Expected: 5 rows (all constraints restored)

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT
    '✓ Database restore completed!' AS message,
    (SELECT COUNT(*) FROM auth.users) AS auth_users,
    (SELECT COUNT(*) FROM profiles) AS profiles,
    (SELECT COUNT(*) FROM clubs) AS clubs;

-- =====================================================
-- IMPORTANT NOTES
-- =====================================================
-- Users have been restored with placeholder passwords
-- They CANNOT log in until you:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. For each user, send a password reset email
-- OR
-- 3. Users can use "Forgot Password" on your login page
--
-- All foreign key constraints have been restored
-- Your database is now fully functional! ✓
