-- Migration: Allow users to enroll themselves or their children in packages
-- This allows regular users to create package enrollments during registration

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Admins can manage package enrollments" ON public.package_enrollments;

-- Create separate policies for INSERT, UPDATE, DELETE
-- INSERT: Allow users to enroll themselves or their children
CREATE POLICY "Users can create package enrollments"
ON public.package_enrollments
FOR INSERT
WITH CHECK (
  -- Allow admins and super admins to create any enrollment
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  -- Allow users to enroll themselves or their children
  OR EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.id = package_enrollments.member_id
    AND (
      -- User enrolling themselves
      cm.user_id = auth.uid()
      -- User enrolling their child
      OR EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = cm.child_id
        AND c.parent_user_id = auth.uid()
      )
    )
  )
);

-- UPDATE: Only admins can update enrollments
CREATE POLICY "Admins can update package enrollments"
ON public.package_enrollments
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- DELETE: Only admins can delete enrollments
CREATE POLICY "Admins can delete package enrollments"
ON public.package_enrollments
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);
