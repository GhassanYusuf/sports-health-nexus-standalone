-- Add child_id column to club_members to support children as members
ALTER TABLE public.club_members
ADD COLUMN child_id UUID REFERENCES public.children(id) ON DELETE CASCADE;

-- Add a check to ensure either user_id is set (for adults) or child_id is set (for children), but not both
ALTER TABLE public.club_members
ADD CONSTRAINT member_type_check CHECK (
  (user_id IS NOT NULL AND child_id IS NULL) OR 
  (user_id IS NULL AND child_id IS NOT NULL)
);

-- Update existing policies to work with both users and children
DROP POLICY IF EXISTS "Admins can create club members" ON public.club_members;
DROP POLICY IF EXISTS "Admins can update club members" ON public.club_members;
DROP POLICY IF EXISTS "Admins can view club members" ON public.club_members;

CREATE POLICY "Admins can create club members"
ON public.club_members
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can update club members"
ON public.club_members
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can view club members"
ON public.club_members
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);