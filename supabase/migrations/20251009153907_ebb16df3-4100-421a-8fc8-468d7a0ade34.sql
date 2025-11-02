-- Add cascading deletes for all club-related tables to ensure complete cleanup

-- Club Facilities
ALTER TABLE club_facilities DROP CONSTRAINT IF EXISTS club_facilities_club_id_fkey;
ALTER TABLE club_facilities ADD CONSTRAINT club_facilities_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Facility Pictures
ALTER TABLE facility_pictures DROP CONSTRAINT IF EXISTS facility_pictures_club_facility_id_fkey;
ALTER TABLE facility_pictures ADD CONSTRAINT facility_pictures_club_facility_id_fkey 
  FOREIGN KEY (club_facility_id) REFERENCES club_facilities(id) ON DELETE CASCADE;

-- Facility Operating Hours
ALTER TABLE facility_operating_hours DROP CONSTRAINT IF EXISTS facility_operating_hours_club_facility_id_fkey;
ALTER TABLE facility_operating_hours ADD CONSTRAINT facility_operating_hours_club_facility_id_fkey 
  FOREIGN KEY (club_facility_id) REFERENCES club_facilities(id) ON DELETE CASCADE;

-- Facility Rentable Times
ALTER TABLE facility_rentable_times DROP CONSTRAINT IF EXISTS facility_rentable_times_club_facility_id_fkey;
ALTER TABLE facility_rentable_times ADD CONSTRAINT facility_rentable_times_club_facility_id_fkey 
  FOREIGN KEY (club_facility_id) REFERENCES club_facilities(id) ON DELETE CASCADE;

-- Club Instructors
ALTER TABLE club_instructors DROP CONSTRAINT IF EXISTS club_instructors_club_id_fkey;
ALTER TABLE club_instructors ADD CONSTRAINT club_instructors_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Activities
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_club_id_fkey;
ALTER TABLE activities ADD CONSTRAINT activities_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_club_facility_id_fkey;
ALTER TABLE activities ADD CONSTRAINT activities_club_facility_id_fkey 
  FOREIGN KEY (club_facility_id) REFERENCES club_facilities(id) ON DELETE CASCADE;

-- Activity Schedules
ALTER TABLE activity_schedules DROP CONSTRAINT IF EXISTS activity_schedules_activity_id_fkey;
ALTER TABLE activity_schedules ADD CONSTRAINT activity_schedules_activity_id_fkey 
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE;

-- Club Amenities
ALTER TABLE club_amenities DROP CONSTRAINT IF EXISTS club_amenities_club_id_fkey;
ALTER TABLE club_amenities ADD CONSTRAINT club_amenities_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Club Classes
ALTER TABLE club_classes DROP CONSTRAINT IF EXISTS club_classes_club_id_fkey;
ALTER TABLE club_classes ADD CONSTRAINT club_classes_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Club Community Posts
ALTER TABLE club_community_posts DROP CONSTRAINT IF EXISTS club_community_posts_club_id_fkey;
ALTER TABLE club_community_posts ADD CONSTRAINT club_community_posts_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Club Members
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_club_id_fkey;
ALTER TABLE club_members ADD CONSTRAINT club_members_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Club Packages
ALTER TABLE club_packages DROP CONSTRAINT IF EXISTS club_packages_club_id_fkey;
ALTER TABLE club_packages ADD CONSTRAINT club_packages_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Package Activities
ALTER TABLE package_activities DROP CONSTRAINT IF EXISTS package_activities_package_id_fkey;
ALTER TABLE package_activities ADD CONSTRAINT package_activities_package_id_fkey 
  FOREIGN KEY (package_id) REFERENCES club_packages(id) ON DELETE CASCADE;

-- Club Partners
ALTER TABLE club_partners DROP CONSTRAINT IF EXISTS club_partners_club_id_fkey;
ALTER TABLE club_partners ADD CONSTRAINT club_partners_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Club Pictures
ALTER TABLE club_pictures DROP CONSTRAINT IF EXISTS club_pictures_club_id_fkey;
ALTER TABLE club_pictures ADD CONSTRAINT club_pictures_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Club Products
ALTER TABLE club_products DROP CONSTRAINT IF EXISTS club_products_club_id_fkey;
ALTER TABLE club_products ADD CONSTRAINT club_products_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Club Reviews
ALTER TABLE club_reviews DROP CONSTRAINT IF EXISTS club_reviews_club_id_fkey;
ALTER TABLE club_reviews ADD CONSTRAINT club_reviews_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Club Statistics
ALTER TABLE club_statistics DROP CONSTRAINT IF EXISTS club_statistics_club_id_fkey;
ALTER TABLE club_statistics ADD CONSTRAINT club_statistics_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- Bank Accounts
ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_club_id_fkey;
ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;