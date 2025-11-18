-- Add start_date and end_date to package_enrollments if not exists
ALTER TABLE package_enrollments
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_package_enrollments_end_date
ON package_enrollments(end_date) WHERE is_active = true;

-- Update existing enrollments to calculate end dates based on package duration
UPDATE package_enrollments pe
SET
  start_date = COALESCE(start_date, DATE(pe.enrolled_at)),
  end_date = COALESCE(end_date, DATE(pe.enrolled_at) + INTERVAL '1 month' * COALESCE(
    (SELECT duration_months FROM club_packages WHERE id = pe.package_id), 1
  ))
WHERE start_date IS NULL OR end_date IS NULL;

-- To test the cron job: Update a specific user's enrollment to expire today
-- Replace the email with your test user
UPDATE package_enrollments pe
SET end_date = CURRENT_DATE
FROM transaction_ledger tl
WHERE tl.enrollment_id = pe.id
  AND tl.member_email = 'yousif.testing05@gmail.com';

-- Verify the enrollment
SELECT
  pe.id,
  pe.start_date,
  pe.end_date,
  tl.member_email,
  tl.payment_status,
  tl.description
FROM package_enrollments pe
JOIN transaction_ledger tl ON tl.enrollment_id = pe.id
WHERE tl.member_email = 'yousif.testing05@gmail.com';
