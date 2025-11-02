-- Add unique constraint on phone number (country_code + phone combination)
-- This ensures each phone number can only be used once across the platform
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_phone_unique UNIQUE (country_code, phone);

-- Add index for faster lookups on phone numbers
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(country_code, phone);

-- Note: Email uniqueness is already enforced by Supabase Auth on the auth.users table
-- The auth.users table automatically ensures email addresses are unique