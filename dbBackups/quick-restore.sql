-- =====================================================
-- QUICK RESTORE for pgAdmin 4
-- =====================================================
-- Just copy this entire file and paste into pgAdmin Query Tool
-- Then click Execute (F5)

-- Check which constraints are missing
SELECT
    'Missing: ' || name AS status
FROM (
    VALUES
        ('profiles_user_id_fkey'),
        ('user_roles_user_id_fkey'),
        ('children_parent_user_id_fkey'),
        ('club_instructors_member_id_fkey'),
        ('clubs_business_owner_id_fkey')
) AS expected(name)
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = expected.name
    AND table_schema = 'public'
);

-- Restore all 5 constraints (safe - will skip if exists)
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

-- Verify all constraints were created
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
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
