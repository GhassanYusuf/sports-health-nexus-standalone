-- =====================================================
-- ALTERNATIVE: DELETE ORPHANED DATA
-- =====================================================
-- Use this if you want a clean slate instead of creating stub users
-- WARNING: This will delete 8 profiles and related data

-- =====================================================
-- STEP 1: See what will be deleted
-- =====================================================
SELECT 'Profiles to delete:' AS info, COUNT(*) AS count
FROM profiles WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'User roles to delete:', COUNT(*)
FROM user_roles WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'Children to delete:', COUNT(*)
FROM children WHERE parent_user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'Clubs to update:', COUNT(*)
FROM clubs WHERE business_owner_id NOT IN (SELECT id FROM auth.users);

-- See the actual profiles that will be deleted
SELECT
    user_id,
    name,
    email,
    phone,
    'WILL BE DELETED' AS status
FROM profiles
WHERE user_id NOT IN (SELECT id FROM auth.users)
ORDER BY name;

-- =====================================================
-- STEP 2: Delete orphaned records
-- =====================================================
-- UNCOMMENT BELOW TO ACTUALLY DELETE

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

-- Set clubs business_owner_id to NULL for orphaned owners
UPDATE clubs
SET business_owner_id = NULL
WHERE business_owner_id IS NOT NULL
AND business_owner_id NOT IN (SELECT id FROM auth.users);

SELECT 'All orphaned data deleted' AS status;
*/

-- =====================================================
-- STEP 3: Verify all orphans are gone
-- =====================================================
SELECT
    'profiles' AS table_name,
    COUNT(*) AS remaining_orphans
FROM profiles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'user_roles', COUNT(*)
FROM user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'children', COUNT(*)
FROM children
WHERE parent_user_id NOT IN (SELECT id FROM auth.users);

-- Expected: All should be 0

-- =====================================================
-- STEP 4: Restore constraints
-- =====================================================
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✓ profiles_user_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ profiles_user_id_fkey exists';
    END;

    BEGIN
        ALTER TABLE public.user_roles
        ADD CONSTRAINT user_roles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✓ user_roles_user_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ user_roles_user_id_fkey exists';
    END;

    BEGIN
        ALTER TABLE public.children
        ADD CONSTRAINT children_parent_user_id_fkey
        FOREIGN KEY (parent_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✓ children_parent_user_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ children_parent_user_id_fkey exists';
    END;

    BEGIN
        ALTER TABLE public.club_instructors
        ADD CONSTRAINT club_instructors_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES public.club_members(id) ON DELETE CASCADE;
        RAISE NOTICE '✓ club_instructors_member_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ club_instructors_member_id_fkey exists';
    END;

    BEGIN
        ALTER TABLE public.clubs
        ADD CONSTRAINT clubs_business_owner_id_fkey
        FOREIGN KEY (business_owner_id) REFERENCES auth.users(id);
        RAISE NOTICE '✓ clubs_business_owner_id_fkey';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '○ clubs_business_owner_id_fkey exists';
    END;
END $$;

-- =====================================================
-- NOTES
-- =====================================================
-- After deletion, you'll need to recreate users properly:
-- 1. Go to Supabase Dashboard → Authentication
-- 2. Invite users with proper emails
-- 3. They create accounts through your app
-- 4. Their profiles will be created through your app's signup flow
