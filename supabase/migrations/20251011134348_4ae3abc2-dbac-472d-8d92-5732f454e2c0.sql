-- Update the RLS policy for club_reviews to only allow current or former members to create reviews
DROP POLICY IF EXISTS "Users can create reviews" ON public.club_reviews;

CREATE POLICY "Only members can create reviews"
ON public.club_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_members.club_id = club_reviews.club_id 
    AND club_members.user_id = auth.uid()
  )
);

-- Update the UPDATE policy to also check membership
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.club_reviews;

CREATE POLICY "Members can update their own reviews"
ON public.club_reviews
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_members.club_id = club_reviews.club_id 
    AND club_members.user_id = auth.uid()
  )
);

-- Update the DELETE policy to also check membership
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.club_reviews;

CREATE POLICY "Members can delete their own reviews"
ON public.club_reviews
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 
    FROM public.club_members 
    WHERE club_members.club_id = club_reviews.club_id 
    AND club_members.user_id = auth.uid()
  )
);