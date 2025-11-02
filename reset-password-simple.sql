-- Simple password reset for platformtakeone@gmail.com
-- Password will be: password123

-- Update only the password hash and email confirmation
UPDATE auth.users
SET
    encrypted_password = '$2a$10$rI0K9vQmI4eZvEKGvXqmqOYJXJZ3p8VY7xVHQqKL0lYFqJmJ0LFEC',
    email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email = 'platformtakeone@gmail.com';

-- Verify it worked
SELECT
    email,
    email_confirmed_at IS NOT NULL as is_confirmed,
    encrypted_password != '$2a$10$RESTORED_USER_NEEDS_PASSWORD_RESET' as has_real_password
FROM auth.users
WHERE email = 'platformtakeone@gmail.com';
