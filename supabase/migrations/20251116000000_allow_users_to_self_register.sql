-- Migration: Allow users to create their own club memberships
-- This allows regular users to register themselves or their children to clubs

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Admins can create club members" ON public.club_members;

-- Create a new policy that allows:
-- 1. Admins and super_admins to create any club member
-- 2. Regular users to create club memberships for themselves (user_id = auth.uid())
-- 3. Regular users to create club memberships for their children
CREATE POLICY "Users can create club memberships"
ON public.club_members
FOR INSERT
WITH CHECK (
  -- Allow admins and super admins to create any member
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  -- Allow users to create their own membership
  OR (auth.uid() = user_id)
  -- Allow users to create memberships for their children
  OR (
    child_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.children
      WHERE id = club_members.child_id
      AND parent_user_id = auth.uid()
    )
  )
);
