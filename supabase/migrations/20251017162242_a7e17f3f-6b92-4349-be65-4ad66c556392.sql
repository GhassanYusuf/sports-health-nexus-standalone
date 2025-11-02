-- Update existing clubs with Bahrain country code
UPDATE public.clubs 
SET country_iso = 'BH'
WHERE country_iso IS NULL 
  AND (location ILIKE '%bahrain%' OR location ILIKE '%manama%');

-- For any remaining NULL values, default to BH
UPDATE public.clubs 
SET country_iso = 'BH'
WHERE country_iso IS NULL;