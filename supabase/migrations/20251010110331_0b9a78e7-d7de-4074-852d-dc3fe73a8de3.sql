-- Remove fitness_goal column from profiles table as it should be club-specific
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS fitness_goal;