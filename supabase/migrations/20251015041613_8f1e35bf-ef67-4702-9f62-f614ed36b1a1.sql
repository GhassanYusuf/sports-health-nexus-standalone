-- Fix clubs SELECT policy to ensure super_admin can view all clubs
-- The current "Anyone can view clubs" policy should work, but let's verify it exists

-- Drop and recreate to ensure it's correct
DROP POLICY IF EXISTS "Anyone can view clubs" ON public.clubs;

CREATE POLICY "Anyone can view clubs" 
ON public.clubs 
FOR SELECT 
USING (true);

-- Also ensure super_admin can see everything with explicit policy
DROP POLICY IF EXISTS "Super admins can view all clubs" ON public.clubs;

CREATE POLICY "Super admins can view all clubs" 
ON public.clubs 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);