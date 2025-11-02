-- Add missing columns to existing tables
ALTER TABLE public.club_packages 
ADD COLUMN IF NOT EXISTS popularity INTEGER DEFAULT 85,
ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'single';

ALTER TABLE public.club_classes 
ADD COLUMN IF NOT EXISTS gender_restriction TEXT DEFAULT 'mixed';

-- Update sample data for packages
UPDATE public.club_packages 
SET activity_type = CASE 
  WHEN random() > 0.6 THEN 'multi'
  ELSE 'single'
END,
popularity = (random() * 30)::int + 70
WHERE popularity IS NULL;