-- Add map_zoom column to club_facilities table to persist zoom level
ALTER TABLE public.club_facilities 
ADD COLUMN IF NOT EXISTS map_zoom integer DEFAULT 13;