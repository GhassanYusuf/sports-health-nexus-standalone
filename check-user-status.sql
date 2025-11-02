-- Run this in your Supabase SQL Editor to check your account status

-- Check if auth account exists
SELECT id, email, created_at, confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Check if profile exists
SELECT user_id, name, email, phone, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- Find orphaned auth accounts (auth account exists but no profile)
SELECT u.id, u.email, u.created_at, p.user_id as has_profile
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL
ORDER BY u.created_at DESC;
