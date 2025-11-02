-- Create club_amenities table
CREATE TABLE public.club_amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.club_amenities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club amenities"
ON public.club_amenities FOR SELECT
USING (true);

CREATE POLICY "Admins can manage club amenities"
ON public.club_amenities FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create club_instructors table
CREATE TABLE public.club_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  rating NUMERIC(2,1) DEFAULT 4.5,
  experience TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.club_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club instructors"
ON public.club_instructors FOR SELECT
USING (true);

CREATE POLICY "Admins can manage club instructors"
ON public.club_instructors FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create club_classes table
CREATE TABLE public.club_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.club_instructors(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  time TEXT NOT NULL,
  duration INTEGER DEFAULT 60,
  available BOOLEAN DEFAULT true,
  max_capacity INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.club_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club classes"
ON public.club_classes FOR SELECT
USING (true);

CREATE POLICY "Admins can manage club classes"
ON public.club_classes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create club_reviews table
CREATE TABLE public.club_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.club_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club reviews"
ON public.club_reviews FOR SELECT
USING (true);

CREATE POLICY "Users can create reviews"
ON public.club_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.club_reviews FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.club_reviews FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reviews"
ON public.club_reviews FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create club_packages table
CREATE TABLE public.club_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  duration_months INTEGER NOT NULL,
  features TEXT[] NOT NULL,
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.club_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club packages"
ON public.club_packages FOR SELECT
USING (true);

CREATE POLICY "Admins can manage club packages"
ON public.club_packages FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create club_products table (for shop)
CREATE TABLE public.club_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  in_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.club_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club products"
ON public.club_products FOR SELECT
USING (true);

CREATE POLICY "Admins can manage club products"
ON public.club_products FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create club_partners table
CREATE TABLE public.club_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_text TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.club_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club partners"
ON public.club_partners FOR SELECT
USING (true);

CREATE POLICY "Admins can manage club partners"
ON public.club_partners FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add update triggers
CREATE TRIGGER update_club_amenities_updated_at
BEFORE UPDATE ON public.club_amenities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_instructors_updated_at
BEFORE UPDATE ON public.club_instructors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_classes_updated_at
BEFORE UPDATE ON public.club_classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_reviews_updated_at
BEFORE UPDATE ON public.club_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_packages_updated_at
BEFORE UPDATE ON public.club_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_products_updated_at
BEFORE UPDATE ON public.club_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_partners_updated_at
BEFORE UPDATE ON public.club_partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();