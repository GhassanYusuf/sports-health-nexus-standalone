-- Create table to track package enrollments
CREATE TABLE IF NOT EXISTS public.package_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.club_packages(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(package_id, member_id)
);

-- Enable RLS
ALTER TABLE public.package_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage package enrollments"
  ON public.package_enrollments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view package enrollments"
  ON public.package_enrollments
  FOR SELECT
  USING (true);

-- Create function to calculate package popularity
CREATE OR REPLACE FUNCTION public.calculate_package_popularity(p_package_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_club_id UUID;
  v_package_members INTEGER;
  v_total_members INTEGER;
  v_popularity NUMERIC;
BEGIN
  -- Get the club_id for this package
  SELECT club_id INTO v_club_id
  FROM public.club_packages
  WHERE id = p_package_id;

  -- Count active members in this specific package
  SELECT COUNT(DISTINCT pe.member_id) INTO v_package_members
  FROM public.package_enrollments pe
  WHERE pe.package_id = p_package_id
    AND pe.is_active = true;

  -- Count total active members across all packages in the same club
  SELECT COUNT(DISTINCT pe.member_id) INTO v_total_members
  FROM public.package_enrollments pe
  INNER JOIN public.club_packages cp ON pe.package_id = cp.id
  WHERE cp.club_id = v_club_id
    AND pe.is_active = true;

  -- Calculate percentage (avoid division by zero)
  IF v_total_members > 0 THEN
    v_popularity := (v_package_members::NUMERIC / v_total_members::NUMERIC) * 100;
  ELSE
    v_popularity := 0;
  END IF;

  RETURN ROUND(v_popularity, 0);
END;
$$;

-- Add trigger to update popularity when enrollments change
CREATE OR REPLACE FUNCTION public.update_package_popularity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_club_id UUID;
BEGIN
  -- Get club_id from the package
  SELECT club_id INTO v_club_id
  FROM public.club_packages
  WHERE id = COALESCE(NEW.package_id, OLD.package_id);

  -- Update popularity for all packages in this club
  UPDATE public.club_packages
  SET popularity = public.calculate_package_popularity(id)
  WHERE club_id = v_club_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_popularity_on_enrollment_change
  AFTER INSERT OR UPDATE OR DELETE ON public.package_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_package_popularity();

-- Create indexes for performance
CREATE INDEX idx_package_enrollments_package_id ON public.package_enrollments(package_id);
CREATE INDEX idx_package_enrollments_member_id ON public.package_enrollments(member_id);
CREATE INDEX idx_package_enrollments_active ON public.package_enrollments(is_active);