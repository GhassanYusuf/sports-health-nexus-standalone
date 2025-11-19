-- Performance optimization: Add indexes for faster club statistics queries
-- The clubs table already has member_count, classes_count, trainers_count columns

-- Add index on package_enrollments for faster active member lookups
CREATE INDEX IF NOT EXISTS idx_package_enrollments_active
ON package_enrollments(package_id, is_active, enrolled_at)
WHERE is_active = true;

-- Add index on club_packages for faster joins
CREATE INDEX IF NOT EXISTS idx_club_packages_club_id
ON club_packages(club_id);

-- Add index on club_instructors for faster counts
CREATE INDEX IF NOT EXISTS idx_club_instructors_club_id
ON club_instructors(club_id);

-- Add composite index for enrollment queries with date filtering
CREATE INDEX IF NOT EXISTS idx_package_enrollments_club_member_date
ON package_enrollments(package_id, member_id, enrolled_at, is_active);

-- Add index on transaction_ledger for financial queries
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_club_date
ON transaction_ledger(club_id, transaction_date, deleted_at)
WHERE deleted_at IS NULL;

-- Add index for GPS-based queries (club search by location)
CREATE INDEX IF NOT EXISTS idx_clubs_gps_location
ON clubs(gps_latitude, gps_longitude)
WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL;

COMMENT ON INDEX idx_package_enrollments_active IS 'Speeds up active enrollment queries';
