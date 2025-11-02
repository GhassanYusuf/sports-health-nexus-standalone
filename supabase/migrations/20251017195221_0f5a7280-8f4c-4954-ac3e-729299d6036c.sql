-- Remove duplicates from package_activities table
DELETE FROM package_activities pa1
USING package_activities pa2
WHERE pa1.id > pa2.id 
  AND pa1.package_id = pa2.package_id
  AND pa1.activity_id = pa2.activity_id
  AND COALESCE(pa1.instructor_id::text, 'null') = COALESCE(pa2.instructor_id::text, 'null')
  AND COALESCE(pa1.class_id::text, 'null') = COALESCE(pa2.class_id::text, 'null');

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS unique_package_activity_instructor 
ON package_activities (package_id, activity_id, COALESCE(instructor_id, '00000000-0000-0000-0000-000000000000'::uuid));