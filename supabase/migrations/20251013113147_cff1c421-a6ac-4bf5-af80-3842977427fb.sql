-- Role lookup for login (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_user_role_for_login(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = p_user_id
  ORDER BY CASE role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
  LIMIT 1;
$$;