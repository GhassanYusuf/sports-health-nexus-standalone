-- Remove features column from club_packages table
ALTER TABLE public.club_packages 
DROP COLUMN IF EXISTS features;