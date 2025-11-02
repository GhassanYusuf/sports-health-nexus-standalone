-- Update clubs table RLS policies to allow super_admin
DROP POLICY IF EXISTS "Admins can insert clubs" ON public.clubs;
DROP POLICY IF EXISTS "Admins can update clubs" ON public.clubs;
DROP POLICY IF EXISTS "Admins can delete clubs" ON public.clubs;

-- Create new policies that allow both admin and super_admin
CREATE POLICY "Admins can insert clubs" 
ON public.clubs 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can update clubs" 
ON public.clubs 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can delete clubs" 
ON public.clubs 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);