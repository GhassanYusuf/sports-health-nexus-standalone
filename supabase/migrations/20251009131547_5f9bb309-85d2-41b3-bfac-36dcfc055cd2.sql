-- Create table for facility operating hours
CREATE TABLE IF NOT EXISTS public.facility_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_facility_id UUID NOT NULL REFERENCES public.club_facilities(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facility_operating_hours ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage operating hours"
  ON public.facility_operating_hours
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view operating hours"
  ON public.facility_operating_hours
  FOR SELECT
  USING (true);

-- Remove the operating_days column from club_facilities as we're replacing it
ALTER TABLE public.club_facilities DROP COLUMN IF EXISTS operating_days;

-- Remove the opening_time and closing_time columns as they're now per-day
ALTER TABLE public.club_facilities DROP COLUMN IF EXISTS opening_time;
ALTER TABLE public.club_facilities DROP COLUMN IF EXISTS closing_time;