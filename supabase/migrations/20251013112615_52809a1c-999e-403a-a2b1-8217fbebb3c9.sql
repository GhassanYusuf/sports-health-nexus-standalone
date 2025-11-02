-- Create a secure function to lookup user profile for login
-- This bypasses RLS using SECURITY DEFINER to allow unauthenticated lookups
CREATE OR REPLACE FUNCTION public.lookup_profile_for_login(identifier text)
RETURNS TABLE (
  user_id uuid,
  avatar_url text,
  name text,
  email text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if identifier looks like a phone number
  IF identifier ~ '^\+?[\d\s\-\(\)]+$' THEN
    -- Remove spaces and lookup by phone
    RETURN QUERY
    SELECT p.user_id, p.avatar_url, p.name, p.email, p.phone
    FROM public.profiles p
    WHERE p.phone = regexp_replace(identifier, '\s', '', 'g')
    LIMIT 1;
  ELSE
    -- Lookup by email
    RETURN QUERY
    SELECT p.user_id, p.avatar_url, p.name, p.email, p.phone
    FROM public.profiles p
    WHERE p.email = identifier
    LIMIT 1;
  END IF;
END;
$$;