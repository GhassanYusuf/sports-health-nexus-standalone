-- Rename facilities table to club_facilities
ALTER TABLE public.facilities RENAME TO club_facilities;

-- Update the foreign key column name in facility_pictures to match
ALTER TABLE public.facility_pictures RENAME COLUMN facility_id TO club_facility_id;

-- Update the foreign key column name in facility_rentable_times to match
ALTER TABLE public.facility_rentable_times RENAME COLUMN facility_id TO club_facility_id;

-- Update the foreign key column name in activities to match
ALTER TABLE public.activities RENAME COLUMN facility_id TO club_facility_id;