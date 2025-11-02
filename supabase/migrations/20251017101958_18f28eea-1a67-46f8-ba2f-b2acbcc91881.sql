-- Add missing columns to club_partners table for partner benefits feature
ALTER TABLE public.club_partners 
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS terms text,
ADD COLUMN IF NOT EXISTS requirements text,
ADD COLUMN IF NOT EXISTS contact_info jsonb DEFAULT '{}'::jsonb;

-- Add comment for category column
COMMENT ON COLUMN public.club_partners.category IS 'Category of partner business: shop, nutrition, physiotherapy, supplements, venues, food_plans';

-- Add offers_personal_training column to club_instructors table
ALTER TABLE public.club_instructors
ADD COLUMN IF NOT EXISTS offers_personal_training boolean DEFAULT false;

COMMENT ON COLUMN public.club_instructors.offers_personal_training IS 'Whether instructor offers personal training sessions outside scheduled club hours';