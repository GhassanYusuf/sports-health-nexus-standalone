-- =====================================================
-- RESTORE DROPPED FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Run this AFTER importing your data successfully
-- These constraints ensure referential integrity

-- 1. profiles.user_id → auth.users.id
-- Links user profiles to authentication users
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 2. user_roles.user_id → auth.users.id  
-- Links user roles to authentication users
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 3. children.parent_user_id → auth.users.id
-- Links children to their parent user
ALTER TABLE public.children 
ADD CONSTRAINT children_parent_user_id_fkey 
FOREIGN KEY (parent_user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 4. club_instructors.member_id → club_members.id
-- Links instructors to their club membership
ALTER TABLE public.club_instructors 
ADD CONSTRAINT club_instructors_member_id_fkey 
FOREIGN KEY (member_id) 
REFERENCES public.club_members(id) 
ON DELETE SET NULL;

-- 5. clubs.business_owner_id → auth.users.id
-- Links clubs to their business owner
ALTER TABLE public.clubs 
ADD CONSTRAINT clubs_business_owner_id_fkey 
FOREIGN KEY (business_owner_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- =====================================================
-- Verify constraints were created
-- =====================================================
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
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
