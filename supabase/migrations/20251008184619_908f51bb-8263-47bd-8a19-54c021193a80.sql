-- Add club_phone_code column to clubs table
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS club_phone_code TEXT;