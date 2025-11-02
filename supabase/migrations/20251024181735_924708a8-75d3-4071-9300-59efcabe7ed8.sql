-- Create function to get registered users count (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_registered_users_count()
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(*)::INTEGER FROM public.profiles;
$$;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_registered_users_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_registered_users_count() TO authenticated;