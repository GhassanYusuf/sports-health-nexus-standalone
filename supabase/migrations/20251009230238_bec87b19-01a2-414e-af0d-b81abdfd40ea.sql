-- Add description column to club_packages table
ALTER TABLE public.club_packages 
ADD COLUMN IF NOT EXISTS description TEXT;