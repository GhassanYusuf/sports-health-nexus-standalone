-- =====================================================
-- STEP 1: CHECK IF CONSTRAINTS EXIST
-- =====================================================
-- Copy and run this query first to see which constraints are missing

SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
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

-- If the query returns 0 rows, ALL constraints are missing
-- If it returns 1-4 rows, SOME constraints are missing
-- If it returns 5 rows, ALL constraints exist

-- =====================================================
-- STEP 2: RESTORE MISSING CONSTRAINTS
-- =====================================================
-- Run this ONLY for the constraints that are missing
-- Based on your original migration files

-- 1. profiles.user_id → auth.users.id
-- Source: 20251006144453_e2faa51d-86ee-4f21-b966-489acef72dfc.sql:40
-- Ensures every profile belongs to a real authenticated user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'profiles_user_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;

        RAISE NOTICE 'Added constraint: profiles_user_id_fkey';
    ELSE
        RAISE NOTICE 'Constraint already exists: profiles_user_id_fkey';
    END IF;
END $$;

-- 2. user_roles.user_id → auth.users.id
-- Source: 20251006142818_3251ba1c-8a22-45ed-902a-a20cc31122d3.sql:7
-- Ensures user roles belong to real authenticated users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_roles_user_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.user_roles
        ADD CONSTRAINT user_roles_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;

        RAISE NOTICE 'Added constraint: user_roles_user_id_fkey';
    ELSE
        RAISE NOTICE 'Constraint already exists: user_roles_user_id_fkey';
    END IF;
END $$;

-- 3. children.parent_user_id → auth.users.id
-- Source: 20251006144453_e2faa51d-86ee-4f21-b966-489acef72dfc.sql:57
-- Ensures children are linked to real parent users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'children_parent_user_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.children
        ADD CONSTRAINT children_parent_user_id_fkey
        FOREIGN KEY (parent_user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;

        RAISE NOTICE 'Added constraint: children_parent_user_id_fkey';
    ELSE
        RAISE NOTICE 'Constraint already exists: children_parent_user_id_fkey';
    END IF;
END $$;

-- 4. club_instructors.member_id → club_members.id
-- Source: 20251012083806_6088a0b0-08b9-48a5-b977-1a7a536bdde7.sql:3
-- Links instructors to their club membership records
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'club_instructors_member_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.club_instructors
        ADD CONSTRAINT club_instructors_member_id_fkey
        FOREIGN KEY (member_id)
        REFERENCES public.club_members(id)
        ON DELETE CASCADE;

        RAISE NOTICE 'Added constraint: club_instructors_member_id_fkey';
    ELSE
        RAISE NOTICE 'Constraint already exists: club_instructors_member_id_fkey';
    END IF;
END $$;

-- 5. clubs.business_owner_id → auth.users.id
-- Source: 20251016182421_34644c5c-22bd-4f7d-9561-19dd7ca827ed.sql:5
-- Links clubs to their business owner (optional, can be NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'clubs_business_owner_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.clubs
        ADD CONSTRAINT clubs_business_owner_id_fkey
        FOREIGN KEY (business_owner_id)
        REFERENCES auth.users(id);
        -- Note: No ON DELETE CASCADE - allows historical club data if owner is deleted

        RAISE NOTICE 'Added constraint: clubs_business_owner_id_fkey';
    ELSE
        RAISE NOTICE 'Constraint already exists: clubs_business_owner_id_fkey';
    END IF;
END $$;

-- =====================================================
-- STEP 3: CREATE INDEXES (if they don't exist)
-- =====================================================
-- These improve query performance on foreign key columns

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_children_parent_user_id ON public.children(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_club_instructors_member_id ON public.club_instructors(member_id);
CREATE INDEX IF NOT EXISTS idx_clubs_business_owner_id ON public.clubs(business_owner_id);

-- =====================================================
-- STEP 4: VERIFY ALL CONSTRAINTS
-- =====================================================
-- Run this to confirm all constraints were created successfully

SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
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

-- Expected result: 5 rows showing all constraints with their delete rules

-- =====================================================
-- NOTES
-- =====================================================
-- These constraints are CRITICAL for data integrity:
--
-- 1. profiles_user_id_fkey: ON DELETE CASCADE
--    When a user account is deleted, their profile is automatically deleted
--
-- 2. user_roles_user_id_fkey: ON DELETE CASCADE
--    When a user account is deleted, their roles are automatically deleted
--
-- 3. children_parent_user_id_fkey: ON DELETE CASCADE
--    When a parent user is deleted, their children records are deleted
--
-- 4. club_instructors_member_id_fkey: ON DELETE CASCADE
--    When a club member is deleted, their instructor record is deleted
--
-- 5. clubs_business_owner_id_fkey: NO ACTION (default)
--    Business owner can be NULL, preserves historical club data
--
-- WARNING: Do NOT drop these constraints unless you understand the
-- implications for data integrity and have a specific reason!
