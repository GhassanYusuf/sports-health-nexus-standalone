-- =====================================================
-- DIAGNOSE AND FIX ORPHANED RECORDS
-- =====================================================
-- Run this in pgAdmin 4 Query Tool

-- =====================================================
-- STEP 1: IDENTIFY ALL ORPHANED RECORDS
-- =====================================================

-- Check profiles with missing auth users
SELECT
    'profiles' AS table_name,
    COUNT(*) AS orphaned_count,
    array_agg(DISTINCT user_id) AS missing_user_ids
FROM profiles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Check user_roles with missing auth users
SELECT
    'user_roles' AS table_name,
    COUNT(*) AS orphaned_count,
    array_agg(DISTINCT user_id) AS missing_user_ids
FROM user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Check children with missing parent auth users
SELECT
    'children' AS table_name,
    COUNT(*) AS orphaned_count,
    array_agg(DISTINCT parent_user_id) AS missing_user_ids
FROM children
WHERE parent_user_id NOT IN (SELECT id FROM auth.users);

-- Check clubs with missing business owner auth users (can be NULL)
SELECT
    'clubs' AS table_name,
    COUNT(*) AS orphaned_count,
    array_agg(DISTINCT business_owner_id) AS missing_user_ids
FROM clubs
WHERE business_owner_id IS NOT NULL
AND business_owner_id NOT IN (SELECT id FROM auth.users);

-- =====================================================
-- STEP 2: DETAILED LIST OF ORPHANED PROFILES
-- =====================================================
-- Shows which specific users are missing

SELECT
    p.id AS profile_id,
    p.user_id,
    p.name,
    p.email,
    p.phone,
    p.created_at
FROM profiles p
WHERE p.user_id NOT IN (SELECT id FROM auth.users)
ORDER BY p.created_at;

-- =====================================================
-- STEP 3A: SOLUTION - CREATE MISSING AUTH USERS
-- =====================================================
-- This creates stub auth.users entries for the missing users
-- WARNING: These users won't be able to log in until you set up proper auth

DO $$
DECLARE
    missing_user_id UUID;
    user_email TEXT;
BEGIN
    -- Loop through each missing user and create them in auth.users
    FOR missing_user_id, user_email IN
        SELECT DISTINCT p.user_id, COALESCE(p.email, p.user_id::text || '@restored.local')
        FROM profiles p
        WHERE p.user_id NOT IN (SELECT id FROM auth.users)
    LOOP
        -- Insert into auth.users (Supabase auth schema)
        -- Note: This creates a basic entry - users cannot log in until proper auth is set up
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
            recovery_token
        ) VALUES (
            missing_user_id,
            '00000000-0000-0000-0000-000000000000',  -- Default instance
            'authenticated',
            'authenticated',
            user_email,
            '$2a$10$PLACEHOLDER_HASH_NO_LOGIN',  -- Placeholder - cannot login
            NOW(),  -- Email confirmed
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            false,
            '',
            ''
        )
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Created auth.users entry for: % (%)', user_email, missing_user_id;
    END LOOP;
END $$;

-- =====================================================
-- STEP 3B: ALTERNATIVE - DELETE ORPHANED RECORDS
-- =====================================================
-- USE THIS INSTEAD if you want to remove orphaned data
-- UNCOMMENT THE LINES BELOW TO USE THIS APPROACH

/*
-- Delete orphaned profiles
DELETE FROM profiles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Delete orphaned user_roles
DELETE FROM user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Delete orphaned children
DELETE FROM children
WHERE parent_user_id NOT IN (SELECT id FROM auth.users);

-- Set clubs business_owner_id to NULL if orphaned
UPDATE clubs
SET business_owner_id = NULL
WHERE business_owner_id IS NOT NULL
AND business_owner_id NOT IN (SELECT id FROM auth.users);

SELECT 'Deleted all orphaned records' AS status;
*/

-- =====================================================
-- STEP 4: VERIFY NO MORE ORPHANS
-- =====================================================

SELECT
    'Remaining orphans' AS check_name,
    COUNT(*) AS count
FROM profiles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT
    'user_roles orphans',
    COUNT(*)
FROM user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT
    'children orphans',
    COUNT(*)
FROM children
WHERE parent_user_id NOT IN (SELECT id FROM auth.users);

-- Expected: All counts should be 0

-- =====================================================
-- STEP 5: NOW RESTORE CONSTRAINTS
-- =====================================================
-- After fixing orphans, run this to add constraints back

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

-- Final verification
SELECT
    tc.constraint_name,
    tc.table_name,
    'EXISTS' as status
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

-- =====================================================
-- NOTES
-- =====================================================
-- SOLUTION 3A (Create missing users):
-- + Preserves all data
-- + Users exist but CANNOT log in (password is placeholder)
-- - Need to set up proper authentication later
-- - Recommended if this is a data restore
--
-- SOLUTION 3B (Delete orphans):
-- + Clean database, no orphaned data
-- + Simple solution
-- - Loses profile data for missing users
-- - Recommended if this is a fresh import or test data
