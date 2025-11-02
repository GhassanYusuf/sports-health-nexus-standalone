-- Change the default value of popularity from 85 to 0
ALTER TABLE public.club_packages 
ALTER COLUMN popularity SET DEFAULT 0;

-- Recalculate popularity for all existing packages
UPDATE public.club_packages
SET popularity = public.calculate_package_popularity(id);