-- Performance optimization for Admin Panel queries
-- Adds indexes to speed up member, profile, and enrollment lookups

-- Index for club_members queries (used heavily in admin panel)
CREATE INDEX IF NOT EXISTS idx_club_members_club_id
ON club_members(club_id, is_active);

CREATE INDEX IF NOT EXISTS idx_club_members_user_id
ON club_members(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_members_child_id
ON club_members(child_id)
WHERE child_id IS NOT NULL;

-- Index for faster profile lookups by user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
ON profiles(user_id);

-- Index for children lookups
CREATE INDEX IF NOT EXISTS idx_children_parent_user_id
ON children(parent_user_id);

CREATE INDEX IF NOT EXISTS idx_children_id
ON children(id);

-- Index for package enrollments (admin panel financial queries)
CREATE INDEX IF NOT EXISTS idx_package_enrollments_member_id
ON package_enrollments(member_id, is_active);

-- Index for membership requests (admin approvals)
CREATE INDEX IF NOT EXISTS idx_membership_requests_club_status
ON membership_requests(club_id, status, requested_at DESC);

-- Composite index for common admin queries
CREATE INDEX IF NOT EXISTS idx_club_members_composite
ON club_members(club_id, is_active, joined_date DESC);

COMMENT ON INDEX idx_club_members_club_id IS 'Speeds up admin member list queries';
COMMENT ON INDEX idx_membership_requests_club_status IS 'Speeds up pending approval queries';
