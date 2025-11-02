-- Ensure super_admin has full access across all tables

-- Update club_members policies
DROP POLICY IF EXISTS "Admins can view club members" ON public.club_members;
CREATE POLICY "Admins can view club members" 
ON public.club_members 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can create club members" ON public.club_members;
CREATE POLICY "Admins can create club members" 
ON public.club_members 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can update club members" ON public.club_members;
CREATE POLICY "Admins can update club members" 
ON public.club_members 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update activities policies
DROP POLICY IF EXISTS "Admins can manage activities" ON public.activities;
CREATE POLICY "Admins can manage activities" 
ON public.activities 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update activity_schedules policies
DROP POLICY IF EXISTS "Admins can manage activity schedules" ON public.activity_schedules;
CREATE POLICY "Admins can manage activity schedules" 
ON public.activity_schedules 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update activity_skills policies
DROP POLICY IF EXISTS "Admins can manage activity skills" ON public.activity_skills;
CREATE POLICY "Admins can manage activity skills" 
ON public.activity_skills 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update bank_accounts policies
DROP POLICY IF EXISTS "Admins can manage bank accounts" ON public.bank_accounts;
CREATE POLICY "Admins can manage bank accounts" 
ON public.bank_accounts 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_amenities policies
DROP POLICY IF EXISTS "Admins can manage club amenities" ON public.club_amenities;
CREATE POLICY "Admins can manage club amenities" 
ON public.club_amenities 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_classes policies
DROP POLICY IF EXISTS "Admins can manage club classes" ON public.club_classes;
CREATE POLICY "Admins can manage club classes" 
ON public.club_classes 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_community_posts policies
DROP POLICY IF EXISTS "Admins can manage club posts" ON public.club_community_posts;
CREATE POLICY "Admins can manage club posts" 
ON public.club_community_posts 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_facilities policies
DROP POLICY IF EXISTS "Admins can manage facilities" ON public.club_facilities;
CREATE POLICY "Admins can manage facilities" 
ON public.club_facilities 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_instructors policies
DROP POLICY IF EXISTS "Admins can manage club instructors" ON public.club_instructors;
CREATE POLICY "Admins can manage club instructors" 
ON public.club_instructors 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_packages policies
DROP POLICY IF EXISTS "Admins can manage club packages" ON public.club_packages;
CREATE POLICY "Admins can manage club packages" 
ON public.club_packages 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_partners policies
DROP POLICY IF EXISTS "Admins can manage club partners" ON public.club_partners;
CREATE POLICY "Admins can manage club partners" 
ON public.club_partners 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_pictures policies
DROP POLICY IF EXISTS "Admins can manage club pictures" ON public.club_pictures;
CREATE POLICY "Admins can manage club pictures" 
ON public.club_pictures 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_products policies
DROP POLICY IF EXISTS "Admins can manage club products" ON public.club_products;
CREATE POLICY "Admins can manage club products" 
ON public.club_products 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_reviews policies
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.club_reviews;
CREATE POLICY "Admins can manage all reviews" 
ON public.club_reviews 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update club_statistics policies
DROP POLICY IF EXISTS "Admins can manage club statistics" ON public.club_statistics;
CREATE POLICY "Admins can manage club statistics" 
ON public.club_statistics 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update facility_operating_hours policies
DROP POLICY IF EXISTS "Admins can manage operating hours" ON public.facility_operating_hours;
CREATE POLICY "Admins can manage operating hours" 
ON public.facility_operating_hours 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update facility_pictures policies
DROP POLICY IF EXISTS "Admins can manage facility pictures" ON public.facility_pictures;
CREATE POLICY "Admins can manage facility pictures" 
ON public.facility_pictures 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update facility_rentable_times policies
DROP POLICY IF EXISTS "Admins can manage rentable times" ON public.facility_rentable_times;
CREATE POLICY "Admins can manage rentable times" 
ON public.facility_rentable_times 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update instructor_certifications policies
DROP POLICY IF EXISTS "Admins can manage instructor certifications" ON public.instructor_certifications;
CREATE POLICY "Admins can manage instructor certifications" 
ON public.instructor_certifications 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update instructor_reviews policies
DROP POLICY IF EXISTS "Admins can manage all instructor reviews" ON public.instructor_reviews;
CREATE POLICY "Admins can manage all instructor reviews" 
ON public.instructor_reviews 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update member_acquired_skills policies
DROP POLICY IF EXISTS "Admins can manage member acquired skills" ON public.member_acquired_skills;
CREATE POLICY "Admins can manage member acquired skills" 
ON public.member_acquired_skills 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update membership_history policies
DROP POLICY IF EXISTS "Admins can manage membership history" ON public.membership_history;
CREATE POLICY "Admins can manage membership history" 
ON public.membership_history 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update package_activities policies
DROP POLICY IF EXISTS "Admins can manage package activities" ON public.package_activities;
CREATE POLICY "Admins can manage package activities" 
ON public.package_activities 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update package_enrollments policies
DROP POLICY IF EXISTS "Admins can manage package enrollments" ON public.package_enrollments;
CREATE POLICY "Admins can manage package enrollments" 
ON public.package_enrollments 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update profiles policies to allow admins to view all
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Add admin update policy for profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update children policies
DROP POLICY IF EXISTS "Admins can view all children" ON public.children;
DROP POLICY IF EXISTS "Admins can insert children for any user" ON public.children;
DROP POLICY IF EXISTS "Admins can update all children" ON public.children;
DROP POLICY IF EXISTS "Admins can delete all children" ON public.children;

CREATE POLICY "Admins can view all children" 
ON public.children 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can insert children for any user" 
ON public.children 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can update all children" 
ON public.children 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can delete all children" 
ON public.children 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);