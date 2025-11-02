-- Update the calculate_package_popularity function to include expiration logic
CREATE OR REPLACE FUNCTION public.calculate_package_popularity(p_package_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_club_id UUID;
  v_package_members INTEGER;
  v_total_members INTEGER;
  v_popularity NUMERIC;
BEGIN
  -- Get the club_id for this package
  SELECT club_id INTO v_club_id
  FROM public.club_packages
  WHERE id = p_package_id;

  -- Count active members in this specific package (not expired)
  SELECT COUNT(DISTINCT pe.member_id) INTO v_package_members
  FROM public.package_enrollments pe
  INNER JOIN public.club_packages cp ON pe.package_id = cp.id
  WHERE pe.package_id = p_package_id
    AND pe.is_active = true
    AND pe.enrolled_at + (cp.duration_months * INTERVAL '1 month') > NOW();

  -- Count total active members across all packages in the same club (not expired)
  SELECT COUNT(DISTINCT pe.member_id) INTO v_total_members
  FROM public.package_enrollments pe
  INNER JOIN public.club_packages cp ON pe.package_id = cp.id
  WHERE cp.club_id = v_club_id
    AND pe.is_active = true
    AND pe.enrolled_at + (cp.duration_months * INTERVAL '1 month') > NOW();

  -- Calculate percentage (avoid division by zero)
  IF v_total_members > 0 THEN
    v_popularity := (v_package_members::NUMERIC / v_total_members::NUMERIC) * 100;
  ELSE
    v_popularity := 0;
  END IF;

  RETURN ROUND(v_popularity, 0);
END;
$$;

-- Create a function to recalculate all package popularity
CREATE OR REPLACE FUNCTION public.recalculate_all_package_popularity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.club_packages
  SET popularity = public.calculate_package_popularity(id);
END;
$$;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily recalculation at midnight (remove existing schedule if it exists)
SELECT cron.unschedule('recalculate-package-popularity') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'recalculate-package-popularity'
);

SELECT cron.schedule(
  'recalculate-package-popularity',
  '0 0 * * *', -- Daily at midnight
  $$SELECT public.recalculate_all_package_popularity();$$
);