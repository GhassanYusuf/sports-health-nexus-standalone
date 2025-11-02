-- Add map_zoom column to clubs table to persist zoom level
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS map_zoom integer DEFAULT 13;