-- Drop existing function first
DROP FUNCTION IF EXISTS public.lookup_profile_for_login(text);

-- Enhanced lookup function that searches by email, phone, OR name
CREATE OR REPLACE FUNCTION public.lookup_profile_for_login(identifier text)
RETURNS TABLE (
  user_id uuid,
  avatar_url text,
  name text,
  email text,
  phone text,
  nationality text
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
    SELECT p.user_id, p.avatar_url, p.name, p.email, p.phone, p.nationality
    FROM public.profiles p
    WHERE p.phone = regexp_replace(identifier, '\s', '', 'g')
    LIMIT 1;
  -- Check if identifier looks like an email
  ELSIF identifier ~ '@' THEN
    -- Lookup by email
    RETURN QUERY
    SELECT p.user_id, p.avatar_url, p.name, p.email, p.phone, p.nationality
    FROM public.profiles p
    WHERE p.email ILIKE identifier
    LIMIT 1;
  ELSE
    -- Lookup by name (case-insensitive partial match)
    RETURN QUERY
    SELECT p.user_id, p.avatar_url, p.name, p.email, p.phone, p.nationality
    FROM public.profiles p
    WHERE p.name ILIKE '%' || identifier || '%'
    ORDER BY 
      -- Prioritize exact matches
      CASE WHEN LOWER(p.name) = LOWER(identifier) THEN 0 ELSE 1 END,
      -- Then by name length (shorter names first)
      LENGTH(p.name)
    LIMIT 5; -- Return up to 5 matches for name search
  END IF;
END;
$$;