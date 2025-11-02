-- Add enrollment fee column to clubs table
ALTER TABLE clubs
ADD COLUMN enrollment_fee NUMERIC DEFAULT 0;