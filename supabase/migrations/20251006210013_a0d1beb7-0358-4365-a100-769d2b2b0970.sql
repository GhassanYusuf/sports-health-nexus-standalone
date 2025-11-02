-- Create junction table for package activities
CREATE TABLE public.package_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.club_packages(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.club_classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(package_id, class_id)
);

-- Add popularity field to packages
ALTER TABLE public.club_packages ADD COLUMN IF NOT EXISTS popularity INTEGER DEFAULT 85;

-- Add activity_type field to packages (single or multi)
ALTER TABLE public.club_packages ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'single';

-- Enable RLS
ALTER TABLE public.package_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view package activities"
  ON public.package_activities FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage package activities"
  ON public.package_activities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add gender_restriction to club_classes
ALTER TABLE public.club_classes ADD COLUMN IF NOT EXISTS gender_restriction TEXT DEFAULT 'mixed';

-- Insert sample package-activity relationships
-- For each club, link packages to classes
INSERT INTO public.package_activities (package_id, class_id)
SELECT p.id, c.id
FROM public.club_packages p
CROSS JOIN LATERAL (
  SELECT id FROM public.club_classes 
  WHERE club_id = p.club_id 
  ORDER BY random() 
  LIMIT CASE 
    WHEN p.activity_type = 'single' THEN 1 
    ELSE 2 
  END
) c
ON CONFLICT DO NOTHING;

-- Update sample data for packages
UPDATE public.club_packages 
SET activity_type = CASE 
  WHEN random() > 0.6 THEN 'multi'
  ELSE 'single'
END,
popularity = (random() * 30)::int + 70
WHERE activity_type IS NULL OR popularity IS NULL;