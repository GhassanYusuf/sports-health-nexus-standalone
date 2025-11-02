-- Remove duplicate club members, keeping only the most recent entry for each unique user
-- This handles duplicates created before the child_id column was added

-- Delete duplicate adult members (where user_id is set), keeping the most recent
WITH ranked_adult_members AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY club_id, user_id 
           ORDER BY created_at DESC
         ) as rn
  FROM public.club_members
  WHERE user_id IS NOT NULL
    AND child_id IS NULL
)
DELETE FROM public.club_members
WHERE id IN (
  SELECT id 
  FROM ranked_adult_members 
  WHERE rn > 1
);

-- Delete duplicate child members (where child_id is set), keeping the most recent
WITH ranked_child_members AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY club_id, child_id 
           ORDER BY created_at DESC
         ) as rn
  FROM public.club_members
  WHERE child_id IS NOT NULL
    AND user_id IS NULL
)
DELETE FROM public.club_members
WHERE id IN (
  SELECT id 
  FROM ranked_child_members 
  WHERE rn > 1
);

-- Create partial unique indexes to prevent future duplicates
-- For adult members (user_id is set, child_id is null)
CREATE UNIQUE INDEX unique_adult_member_per_club_idx
ON public.club_members (club_id, user_id)
WHERE user_id IS NOT NULL AND child_id IS NULL;

-- For child members (child_id is set, user_id is null)
CREATE UNIQUE INDEX unique_child_member_per_club_idx
ON public.club_members (club_id, child_id)
WHERE child_id IS NOT NULL AND user_id IS NULL;