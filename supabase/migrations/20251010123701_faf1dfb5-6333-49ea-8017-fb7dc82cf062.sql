-- Allow admins to insert children for any user
CREATE POLICY "Admins can insert children for any user"
ON public.children
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all children
CREATE POLICY "Admins can view all children"
ON public.children
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update all children
CREATE POLICY "Admins can update all children"
ON public.children
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete all children
CREATE POLICY "Admins can delete all children"
ON public.children
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));