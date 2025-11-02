-- Add country_iso column to clubs table
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS country_iso TEXT;

-- Add index for faster slug lookups with country
CREATE INDEX IF NOT EXISTS idx_clubs_country_slug 
ON public.clubs(country_iso, club_slug);

-- Add comment for documentation
COMMENT ON COLUMN public.clubs.country_iso IS 'ISO 3166-1 alpha-2 country code (e.g., US, AE, GB)';