-- Add start_date and end_date columns to package_enrollments
ALTER TABLE package_enrollments
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Create index for efficient querying of expiring enrollments
CREATE INDEX IF NOT EXISTS idx_package_enrollments_end_date ON package_enrollments(end_date) WHERE is_active = true;

-- Update existing enrollments to have start_date and end_date based on enrolled_at and package duration
UPDATE package_enrollments pe
SET
  start_date = DATE(pe.enrolled_at),
  end_date = DATE(pe.enrolled_at) + INTERVAL '1 month' * COALESCE(pkg.duration_months, 1)
FROM club_packages pkg
WHERE pe.package_id = pkg.id
  AND pe.start_date IS NULL;

-- Add comment
COMMENT ON COLUMN package_enrollments.start_date IS 'Start date of the package enrollment period';
COMMENT ON COLUMN package_enrollments.end_date IS 'End date of the package enrollment period (expiration date)';
