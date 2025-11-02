-- Add missing fields to club_instructors table
ALTER TABLE public.club_instructors
ADD COLUMN IF NOT EXISTS achievements TEXT,
ADD COLUMN IF NOT EXISTS certifications TEXT,
ADD COLUMN IF NOT EXISTS credentials TEXT,
ADD COLUMN IF NOT EXISTS specialty_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS link_tree JSONB DEFAULT '[]'::jsonb;

-- Rename club_amenities to match facilities concept
-- We'll keep both for backward compatibility but focus on facilities table

-- Add missing fields to facilities table if needed
ALTER TABLE public.facilities
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;