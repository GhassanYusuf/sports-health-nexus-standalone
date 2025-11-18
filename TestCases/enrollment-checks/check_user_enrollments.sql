-- Check user enrollments for yousif.testing05@gmail.com

-- 1. Find the user's profile
SELECT
    p.id as profile_id,
    p.name,
    p.email,
    p.user_id,
    p.nationality
FROM profiles p
WHERE p.email = 'yousif.testing05@gmail.com';

-- 2. Find all club memberships for this user
SELECT
    cm.id as membership_id,
    cm.member_id,
    c.name as club_name,
    c.id as club_id,
    pkg.name as package_name,
    pkg.price as package_price,
    cm.status,
    cm.enrolled_at,
    cm.membership_start_date,
    cm.membership_end_date,
    cm.payment_status,
    cm.created_at
FROM club_members cm
JOIN profiles p ON cm.member_id = p.id
JOIN clubs c ON cm.club_id = c.id
LEFT JOIN packages pkg ON cm.package_id = pkg.id
WHERE p.email = 'yousif.testing05@gmail.com'
ORDER BY cm.created_at DESC;

-- 3. Find children registered under this parent
SELECT
    ch.id as child_id,
    ch.name as child_name,
    ch.date_of_birth,
    ch.gender,
    ch.created_at as registered_date
FROM children ch
JOIN profiles p ON ch.parent_id = p.id
WHERE p.email = 'yousif.testing05@gmail.com';

-- 4. Find children's club memberships
SELECT
    cm.id as membership_id,
    ch.name as child_name,
    c.name as club_name,
    pkg.name as package_name,
    pkg.price as package_price,
    cm.status,
    cm.enrolled_at,
    cm.membership_start_date,
    cm.membership_end_date,
    cm.payment_status
FROM club_members cm
JOIN children ch ON cm.member_id = ch.id
JOIN profiles p ON ch.parent_id = p.id
JOIN clubs c ON cm.club_id = c.id
LEFT JOIN packages pkg ON cm.package_id = pkg.id
WHERE p.email = 'yousif.testing05@gmail.com'
ORDER BY cm.created_at DESC;

-- 5. Combined view - All enrollments (user + children)
SELECT
    CASE
        WHEN ch.id IS NOT NULL THEN 'Child'
        ELSE 'Self'
    END as member_type,
    COALESCE(ch.name, p.name) as member_name,
    c.name as club_name,
    pkg.name as package_name,
    pkg.price as package_price,
    c.currency,
    cm.status,
    cm.payment_status,
    cm.enrolled_at,
    cm.membership_start_date,
    cm.membership_end_date
FROM club_members cm
LEFT JOIN profiles p ON cm.member_id = p.id AND p.email = 'yousif.testing05@gmail.com'
LEFT JOIN children ch ON cm.member_id = ch.id
LEFT JOIN profiles parent ON ch.parent_id = parent.id AND parent.email = 'yousif.testing05@gmail.com'
JOIN clubs c ON cm.club_id = c.id
LEFT JOIN packages pkg ON cm.package_id = pkg.id
WHERE p.email = 'yousif.testing05@gmail.com' OR parent.email = 'yousif.testing05@gmail.com'
ORDER BY cm.created_at DESC;

-- 6. Transaction history
SELECT
    tl.id as transaction_id,
    tl.description,
    tl.transaction_type,
    tl.amount,
    tl.vat_amount,
    tl.total_amount,
    c.currency,
    tl.payment_status,
    tl.payment_method,
    tl.transaction_date,
    tl.receipt_number,
    c.name as club_name
FROM transaction_ledger tl
JOIN clubs c ON tl.club_id = c.id
WHERE tl.member_email = 'yousif.testing05@gmail.com'
ORDER BY tl.transaction_date DESC;
