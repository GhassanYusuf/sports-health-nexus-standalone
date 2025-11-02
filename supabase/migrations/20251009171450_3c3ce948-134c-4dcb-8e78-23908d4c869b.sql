-- Make class_id nullable in package_activities table since packages can be linked to activities directly
ALTER TABLE package_activities 
ALTER COLUMN class_id DROP NOT NULL;