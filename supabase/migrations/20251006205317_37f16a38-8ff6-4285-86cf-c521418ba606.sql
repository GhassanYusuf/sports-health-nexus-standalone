-- Create club_members table for top members section
CREATE TABLE public.club_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  user_id UUID,
  name TEXT NOT NULL,
  avatar_url TEXT,
  rank TEXT NOT NULL,
  achievements INTEGER DEFAULT 0,
  joined_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create club_community_posts table for community section
CREATE TABLE public.club_community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create club_statistics table for statistics section
CREATE TABLE public.club_statistics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL,
  total_workouts INTEGER DEFAULT 0,
  active_members INTEGER DEFAULT 0,
  calories_burned BIGINT DEFAULT 0,
  average_session_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_statistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for club_members
CREATE POLICY "Anyone can view club members"
  ON public.club_members FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage club members"
  ON public.club_members FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for club_community_posts
CREATE POLICY "Anyone can view club posts"
  ON public.club_community_posts FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage club posts"
  ON public.club_community_posts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for club_statistics
CREATE POLICY "Anyone can view club statistics"
  ON public.club_statistics FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage club statistics"
  ON public.club_statistics FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert sample data for clubs (assuming we have clubs with certain IDs)
-- First, let's get the club IDs and insert data for each

-- Sample data for club_members (inserting for first few clubs)
INSERT INTO public.club_members (club_id, name, avatar_url, rank, achievements) 
SELECT 
  id,
  'Sarah Johnson',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  'Platinum Member',
  156
FROM public.clubs
LIMIT 1;

INSERT INTO public.club_members (club_id, name, avatar_url, rank, achievements) 
SELECT 
  id,
  'Michael Chen',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
  'Gold Member',
  142
FROM public.clubs
LIMIT 1;

INSERT INTO public.club_members (club_id, name, avatar_url, rank, achievements) 
SELECT 
  id,
  'Emma Davis',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
  'Gold Member',
  138
FROM public.clubs
LIMIT 1;

-- Sample data for club_community_posts
INSERT INTO public.club_community_posts (club_id, author_name, author_avatar, content, likes_count, comments_count)
SELECT 
  id,
  'Alex Thompson',
  'https://images.unsplash.com/photo-1500648067791-00dcc994a43e?w=100&h=100&fit=crop',
  'Just completed my first marathon training cycle! The support from this community has been incredible.',
  24,
  8
FROM public.clubs
LIMIT 1;

INSERT INTO public.club_community_posts (club_id, author_name, author_avatar, content, likes_count, comments_count)
SELECT 
  id,
  'Maria Garcia',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
  'New yoga class starting next week! Who wants to join?',
  19,
  5
FROM public.clubs
LIMIT 1;

-- Sample data for club_statistics
INSERT INTO public.club_statistics (club_id, total_workouts, active_members, calories_burned, average_session_minutes)
SELECT 
  id,
  12847,
  members_count,
  2847392,
  45
FROM public.clubs;