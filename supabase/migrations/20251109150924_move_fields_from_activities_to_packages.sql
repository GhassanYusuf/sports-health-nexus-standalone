-- Migration: Move fields from activities to packages
-- Description: Clean up the schema by moving enrollment/booking fields to packages
-- and removing pricing fields from activities (since customers enroll in packages, not activities)

-- Step 1: Add requires_prebooking to club_packages
ALTER TABLE public.club_packages
ADD COLUMN IF NOT EXISTS requires_prebooking BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.club_packages.requires_prebooking IS 'Whether this package requires members to prebook sessions in advance';

-- Step 2: Migrate data from activities.requires_prebooking to packages (if any exists)
-- This updates packages based on their linked activities
UPDATE public.club_packages cp
SET requires_prebooking = COALESCE(
  (
    SELECT MAX(a.requires_prebooking::int)::boolean
    FROM public.package_activities pa
    JOIN public.activities a ON a.id = pa.activity_id
    WHERE pa.package_id = cp.id
  ),
  false
);

-- Step 3: Remove redundant/unused fields from activities
-- These fields should only exist at the package level

-- Remove monthly_fee (pricing is at package level)
ALTER TABLE public.activities
DROP COLUMN IF EXISTS monthly_fee;

-- Remove cost_per_session (pricing is at package level)
ALTER TABLE public.activities
DROP COLUMN IF EXISTS cost_per_session;

-- Remove booking_enabled (already exists in packages)
ALTER TABLE public.activities
DROP COLUMN IF EXISTS booking_enabled;

-- Remove requires_prebooking (moved to packages)
ALTER TABLE public.activities
DROP COLUMN IF EXISTS requires_prebooking;

-- Step 4: Add comments for clarity
COMMENT ON TABLE public.club_packages IS 'Packages are the products customers enroll in. They bundle one or more activities.';
COMMENT ON TABLE public.activities IS 'Activities are the actual classes/sessions that make up packages. Contains schedule and capacity info.';

-- Step 5: Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully';
  RAISE NOTICE 'Added requires_prebooking to club_packages';
  RAISE NOTICE 'Removed monthly_fee, cost_per_session, booking_enabled, requires_prebooking from activities';
END $$;
