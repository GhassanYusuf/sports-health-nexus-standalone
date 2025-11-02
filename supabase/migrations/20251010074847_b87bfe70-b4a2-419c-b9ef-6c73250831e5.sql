-- Create membership_requests table
CREATE TABLE IF NOT EXISTS public.membership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, club_id)
);

ALTER TABLE public.membership_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for membership_requests
CREATE POLICY "Users can view their own requests"
  ON public.membership_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create membership requests"
  ON public.membership_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all requests"
  ON public.membership_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update requests"
  ON public.membership_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Update club_members RLS to prevent deletion by regular admins
DROP POLICY IF EXISTS "Admins can manage club members" ON public.club_members;

CREATE POLICY "Admins can view club members"
  ON public.club_members FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can create club members"
  ON public.club_members FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update club members"
  ON public.club_members FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Only super admins can delete members"
  ON public.club_members FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'));

-- Add trigger for updated_at on membership_requests
CREATE TRIGGER update_membership_requests_updated_at
  BEFORE UPDATE ON public.membership_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();