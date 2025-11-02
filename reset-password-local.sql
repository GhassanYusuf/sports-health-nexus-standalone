-- Reset password for platformtakeone@gmail.com in LOCAL database
-- This will set the password to: "password123"
-- You can change it after logging in

-- Step 1: Update the password hash
-- This hash is for password: "password123"
UPDATE auth.users
SET encrypted_password = '$2a$10$rI0K9vQmI4eZvEKGvXqmqOYJXJZ3p8VY7xVHQqKL0lYFqJmJ0LFEC',
    updated_at = NOW()
WHERE email = 'platformtakeone@gmail.com';

-- Step 2: Ensure email is confirmed (so you can login)
-- Note: confirmed_at is auto-generated, we only set email_confirmed_at
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'platformtakeone@gmail.com';

-- Step 3: Verify the update
SELECT
    email,
    CASE
        WHEN encrypted_password = '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET'
        THEN '❌ PLACEHOLDER'
        ELSE '✅ REAL PASSWORD'
    END as password_status,
    CASE
        WHEN email_confirmed_at IS NOT NULL
        THEN '✅ CONFIRMED'
        ELSE '❌ NOT CONFIRMED'
    END as email_status
FROM auth.users
WHERE email = 'platformtakeone@gmail.com';
