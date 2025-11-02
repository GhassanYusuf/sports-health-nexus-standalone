-- Create facilities table
CREATE TABLE public.facilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  operating_days TEXT[] NOT NULL,
  is_rentable BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create facility pictures table
CREATE TABLE public.facility_pictures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create facility rentable times table
CREATE TABLE public.facility_rentable_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_day CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))
);

-- Create activities table (modern replacement for club_classes)
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  monthly_fee DECIMAL(10, 2) NOT NULL,
  sessions_per_week INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT positive_fee CHECK (monthly_fee >= 0),
  CONSTRAINT positive_sessions CHECK (sessions_per_week > 0)
);

-- Create activity schedules table
CREATE TABLE public.activity_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_day CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Update club_packages table with new fields
ALTER TABLE public.club_packages
  ADD COLUMN IF NOT EXISTS age_min INTEGER,
  ADD COLUMN IF NOT EXISTS age_max INTEGER,
  ADD COLUMN IF NOT EXISTS gender_restriction TEXT DEFAULT 'mixed',
  ADD COLUMN IF NOT EXISTS picture_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_type TEXT DEFAULT 'duration',
  ADD COLUMN IF NOT EXISTS session_count INTEGER;

-- Add constraints to club_packages
ALTER TABLE public.club_packages
  ADD CONSTRAINT valid_gender CHECK (gender_restriction IN ('mixed', 'male', 'female')),
  ADD CONSTRAINT valid_duration_type CHECK (duration_type IN ('duration', 'session')),
  ADD CONSTRAINT valid_age_range CHECK (age_min IS NULL OR age_max IS NULL OR age_max >= age_min);

-- Update package_activities to link activities and assign trainers
ALTER TABLE public.package_activities
  DROP CONSTRAINT IF EXISTS package_activities_class_id_fkey,
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.club_instructors(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_pictures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_rentable_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for facilities
CREATE POLICY "Anyone can view facilities"
  ON public.facilities FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage facilities"
  ON public.facilities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for facility_pictures
CREATE POLICY "Anyone can view facility pictures"
  ON public.facility_pictures FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage facility pictures"
  ON public.facility_pictures FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for facility_rentable_times
CREATE POLICY "Anyone can view rentable times"
  ON public.facility_rentable_times FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage rentable times"
  ON public.facility_rentable_times FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for activities
CREATE POLICY "Anyone can view activities"
  ON public.activities FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage activities"
  ON public.activities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for activity_schedules
CREATE POLICY "Anyone can view activity schedules"
  ON public.activity_schedules FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage activity schedules"
  ON public.activity_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better query performance
CREATE INDEX idx_facilities_club_id ON public.facilities(club_id);
CREATE INDEX idx_facility_pictures_facility_id ON public.facility_pictures(facility_id);
CREATE INDEX idx_facility_rentable_times_facility_id ON public.facility_rentable_times(facility_id);
CREATE INDEX idx_activities_club_id ON public.activities(club_id);
CREATE INDEX idx_activities_facility_id ON public.activities(facility_id);
CREATE INDEX idx_activity_schedules_activity_id ON public.activity_schedules(activity_id);
CREATE INDEX idx_package_activities_activity_id ON public.package_activities(activity_id);
CREATE INDEX idx_package_activities_instructor_id ON public.package_activities(instructor_id);

-- Create triggers for updated_at
CREATE TRIGGER update_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();