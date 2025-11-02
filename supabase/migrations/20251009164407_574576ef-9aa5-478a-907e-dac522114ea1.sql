-- Create instructor_certifications table
CREATE TABLE public.instructor_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID NOT NULL REFERENCES public.club_instructors(id) ON DELETE CASCADE,
  certificate_name TEXT NOT NULL,
  certificate_image_url TEXT,
  awarded_date DATE NOT NULL,
  issuing_organization TEXT NOT NULL,
  description TEXT,
  certificate_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instructor_certifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view instructor certifications"
  ON public.instructor_certifications
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage instructor certifications"
  ON public.instructor_certifications
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_instructor_certifications_updated_at
  BEFORE UPDATE ON public.instructor_certifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_instructor_certifications_instructor_id 
  ON public.instructor_certifications(instructor_id);