-- =====================================================
-- COMPLETE DATABASE HEALTH CHECK
-- =====================================================
-- Run this in pgAdmin 4 to verify everything is working

-- =====================================================
-- 1. CHECK AUTH USERS
-- =====================================================
SELECT
    '✓ Auth Users' AS check_type,
    COUNT(*) AS count,
    array_agg(email ORDER BY email) AS emails
FROM auth.users;

-- =====================================================
-- 2. CHECK PROFILES
-- =====================================================
SELECT
    '✓ Profiles' AS check_type,
    COUNT(*) AS count,
    array_agg(name ORDER BY name) AS names
FROM profiles;

-- =====================================================
-- 3. CHECK FOR ORPHANED RECORDS
-- =====================================================
-- Should all return 0
SELECT
    'Orphaned Profiles' AS check_type,
    COUNT(*) AS count
FROM profiles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT
    'Orphaned User Roles',
    COUNT(*)
FROM user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT
    'Orphaned Children',
    COUNT(*)
FROM children
WHERE parent_user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT
    'Orphaned Clubs (business_owner)',
    COUNT(*)
FROM clubs
WHERE business_owner_id IS NOT NULL
AND business_owner_id NOT IN (SELECT id FROM auth.users);

-- Expected: All counts = 0

-- =====================================================
-- 4. CHECK FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Should return 5 rows
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS ref_schema,
    ccu.table_name AS ref_table,
    ccu.column_name AS ref_column,
    rc.delete_rule,
    '✓ EXISTS' AS status
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

-- Expected: 5 rows

-- =====================================================
-- 5. CHECK MISSING CONSTRAINTS
-- =====================================================
-- Should return 0 rows (all constraints exist)
SELECT
    missing_constraint AS constraint_name,
    '❌ MISSING' AS status
FROM (
    VALUES
        ('profiles_user_id_fkey'),
        ('user_roles_user_id_fkey'),
        ('children_parent_user_id_fkey'),
        ('club_instructors_member_id_fkey'),
        ('clubs_business_owner_id_fkey')
) AS expected(missing_constraint)
WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = expected.missing_constraint
    AND table_schema = 'public'
    AND constraint_type = 'FOREIGN KEY'
);

-- Expected: 0 rows (all constraints exist)

-- =====================================================
-- 6. DATA INTEGRITY CHECKS
-- =====================================================

-- Check user-profile linkage
SELECT
    'Users with Profiles' AS check_type,
    COUNT(*) AS count
FROM auth.users u
INNER JOIN profiles p ON u.id = p.user_id;

-- Check user roles
SELECT
    'User Roles Distribution' AS check_type,
    role,
    COUNT(*) AS count
FROM user_roles
GROUP BY role
ORDER BY role;

-- Check clubs
SELECT
    'Clubs' AS check_type,
    COUNT(*) AS total_clubs,
    COUNT(business_owner_id) AS clubs_with_owner
FROM clubs;

-- Check children
SELECT
    'Children' AS check_type,
    COUNT(*) AS total_children,
    COUNT(DISTINCT parent_user_id) AS unique_parents
FROM children;

-- =====================================================
-- 7. SUMMARY REPORT
-- =====================================================
SELECT
    '===== DATABASE HEALTH SUMMARY =====' AS report,
    '' AS value
UNION ALL
SELECT
    '✓ Auth Users',
    COUNT(*)::text
FROM auth.users
UNION ALL
SELECT
    '✓ Profiles',
    COUNT(*)::text
FROM profiles
UNION ALL
SELECT
    '✓ User Roles',
    COUNT(*)::text
FROM user_roles
UNION ALL
SELECT
    '✓ Clubs',
    COUNT(*)::text
FROM clubs
UNION ALL
SELECT
    '✓ Club Members',
    COUNT(*)::text
FROM club_members
UNION ALL
SELECT
    '✓ Club Packages',
    COUNT(*)::text
FROM club_packages
UNION ALL
SELECT
    '✓ Children',
    COUNT(*)::text
FROM children
UNION ALL
SELECT
    '✓ Foreign Key Constraints',
    COUNT(*)::text || ' / 5'
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND constraint_name IN (
        'profiles_user_id_fkey',
        'user_roles_user_id_fkey',
        'children_parent_user_id_fkey',
        'club_instructors_member_id_fkey',
        'clubs_business_owner_id_fkey'
    )
UNION ALL
SELECT
    '✓ Orphaned Records',
    (
        SELECT COUNT(*)::text
        FROM profiles
        WHERE user_id NOT IN (SELECT id FROM auth.users)
    ) || ' (should be 0)'
UNION ALL
SELECT
    '================================',
    '';

-- =====================================================
-- 8. FINAL STATUS
-- =====================================================
SELECT
    CASE
        WHEN (
            -- All constraints exist
            (SELECT COUNT(*) FROM information_schema.table_constraints
             WHERE constraint_type = 'FOREIGN KEY'
             AND table_schema = 'public'
             AND constraint_name IN (
                 'profiles_user_id_fkey',
                 'user_roles_user_id_fkey',
                 'children_parent_user_id_fkey',
                 'club_instructors_member_id_fkey',
                 'clubs_business_owner_id_fkey'
             )) = 5
            AND
            -- No orphaned records
            (SELECT COUNT(*) FROM profiles WHERE user_id NOT IN (SELECT id FROM auth.users)) = 0
            AND
            (SELECT COUNT(*) FROM user_roles WHERE user_id NOT IN (SELECT id FROM auth.users)) = 0
            AND
            (SELECT COUNT(*) FROM children WHERE parent_user_id NOT IN (SELECT id FROM auth.users)) = 0
            AND
            -- Auth users and profiles match
            (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM profiles)
        )
        THEN '🎉 DATABASE FULLY RESTORED AND HEALTHY! ✓'
        ELSE '⚠️ SOME ISSUES DETECTED - REVIEW RESULTS ABOVE'
    END AS final_status;
