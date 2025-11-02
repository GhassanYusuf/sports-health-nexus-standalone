-- Add new fields to clubs table for detailed club information
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS welcoming_message text,
ADD COLUMN IF NOT EXISTS gps_latitude numeric,
ADD COLUMN IF NOT EXISTS gps_longitude numeric,
ADD COLUMN IF NOT EXISTS link_tree jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS owner_name text,
ADD COLUMN IF NOT EXISTS owner_contact text,
ADD COLUMN IF NOT EXISTS owner_email text;

-- Create a table for club pictures (multiple images per club)
CREATE TABLE IF NOT EXISTS public.club_pictures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on club_pictures
ALTER TABLE public.club_pictures ENABLE ROW LEVEL SECURITY;

-- Create policies for club_pictures
CREATE POLICY "Admins can manage club pictures"
ON public.club_pictures
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view club pictures"
ON public.club_pictures
FOR SELECT
USING (true);