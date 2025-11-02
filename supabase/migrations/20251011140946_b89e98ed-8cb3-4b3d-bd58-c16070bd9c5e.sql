-- Create instructor reviews table
CREATE TABLE IF NOT EXISTS public.instructor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.club_instructors(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(instructor_id, member_id)
);

-- Enable RLS
ALTER TABLE public.instructor_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view instructor reviews
CREATE POLICY "Anyone can view instructor reviews"
ON public.instructor_reviews
FOR SELECT
USING (true);

-- Members can create reviews for instructors
CREATE POLICY "Members can create instructor reviews"
ON public.instructor_reviews
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_members
    WHERE id = member_id AND is_active = true
  )
);

-- Members can update their own reviews
CREATE POLICY "Members can update their own reviews"
ON public.instructor_reviews
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.club_members
    WHERE id = member_id AND is_active = true
  )
);

-- Members can delete their own reviews
CREATE POLICY "Members can delete their own reviews"
ON public.instructor_reviews
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.club_members
    WHERE id = member_id AND is_active = true
  )
);

-- Admins can manage all instructor reviews
CREATE POLICY "Admins can manage all instructor reviews"
ON public.instructor_reviews
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_instructor_reviews_updated_at
BEFORE UPDATE ON public.instructor_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();