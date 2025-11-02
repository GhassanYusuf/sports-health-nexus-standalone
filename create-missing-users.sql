-- =====================================================
-- CREATE MISSING AUTH USERS FROM PROFILES
-- =====================================================
-- This creates auth.users entries for all orphaned profiles
-- Users will exist but CANNOT login until you invite them via Supabase Dashboard

-- =====================================================
-- STEP 1: See what will be created
-- =====================================================
SELECT
    p.user_id,
    p.name,
    COALESCE(p.email, p.user_id::text || '@placeholder.local') AS email,
    p.phone,
    p.created_at
FROM profiles p
WHERE p.user_id NOT IN (SELECT id FROM auth.users)
ORDER BY p.created_at;

-- =====================================================
-- STEP 2: Create missing auth.users entries
-- =====================================================
-- This makes all profiles valid by creating their auth users

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
)
SELECT
    p.user_id AS id,
    '00000000-0000-0000-0000-000000000000'::uuid AS instance_id,
    'authenticated' AS aud,
    'authenticated' AS role,
    COALESCE(p.email, p.user_id::text || '@restored.placeholder') AS email,
    crypt('RESTORED_USER_NEEDS_PASSWORD_RESET', gen_salt('bf')) AS encrypted_password,
    NOW() AS email_confirmed_at,
    NOW() AS confirmation_sent_at,
    COALESCE(p.created_at, NOW()) AS created_at,
    COALESCE(p.updated_at, NOW()) AS updated_at,
    jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email')
    ) AS raw_app_meta_data,
    jsonb_build_object(
        'name', p.name,
        'phone', p.phone
    ) AS raw_user_meta_data,
    false AS is_super_admin,
    '' AS confirmation_token,
    '' AS recovery_token,
    '' AS email_change_token_new,
    '' AS email_change
FROM profiles p
WHERE p.user_id NOT IN (SELECT id FROM auth.users)
ON CONFLICT (id) DO NOTHING;

-- Show what was created
SELECT
    COUNT(*) AS users_created,
    'Users created successfully' AS status
FROM auth.users
WHERE id IN (SELECT user_id FROM profiles);

-- =====================================================
-- STEP 3: Verify no more orphans
-- =====================================================
SELECT
    'profiles' AS table_name,
    COUNT(*) AS orphaned_count
FROM profiles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT
    'user_roles',
    COUNT(*)
FROM user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT
    'children',
    COUNT(*)
FROM children
WHERE parent_user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT
    'clubs (business_owner)',
    COUNT(*)
FROM clubs
WHERE business_owner_id IS NOT NULL
AND business_owner_id NOT IN (SELECT id FROM auth.users);

-- Expected: All counts should be 0

-- =====================================================
-- STEP 4: Add foreign key constraints back
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
-- STEP 5: Final verification
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

-- Expected: 5 rows (all constraints exist)

-- =====================================================
-- IMPORTANT NEXT STEPS
-- =====================================================
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. You should see 8 users listed
-- 3. For each user, click "Send password recovery email"
--    OR
--    Delete and re-invite them with proper email invites
--
-- These users exist in the database but need proper authentication setup
-- to actually log in to your app.
