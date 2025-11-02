-- Add fields to club_members for tracking leave date
ALTER TABLE public.club_members 
ADD COLUMN IF NOT EXISTS left_date date,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS leave_reason text;

-- Create membership history table
CREATE TABLE IF NOT EXISTS public.membership_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  joined_date date NOT NULL,
  left_date date NOT NULL,
  duration_days integer NOT NULL,
  leave_reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT membership_history_user_or_child CHECK (
    (user_id IS NOT NULL AND child_id IS NULL) OR 
    (user_id IS NULL AND child_id IS NOT NULL)
  )
);

-- Create activity skills table
CREATE TABLE IF NOT EXISTS public.activity_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  skill_category text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(activity_id, skill_name)
);

-- Create member acquired skills table
CREATE TABLE IF NOT EXISTS public.member_acquired_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  membership_history_id uuid NOT NULL REFERENCES public.membership_history(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  skill_category text,
  acquired_from_activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  acquired_date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.membership_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_acquired_skills ENABLE ROW LEVEL SECURITY;

-- RLS policies for membership_history
CREATE POLICY "Admins can manage membership history"
ON public.membership_history FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own membership history"
ON public.membership_history FOR SELECT
USING (auth.uid() = user_id);

-- RLS policies for activity_skills
CREATE POLICY "Admins can manage activity skills"
ON public.activity_skills FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view activity skills"
ON public.activity_skills FOR SELECT
USING (true);

-- RLS policies for member_acquired_skills
CREATE POLICY "Admins can manage member acquired skills"
ON public.member_acquired_skills FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own acquired skills"
ON public.member_acquired_skills FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.membership_history mh
    WHERE mh.id = membership_history_id
    AND mh.user_id = auth.uid()
  )
);

-- Create function to handle member leaving club
CREATE OR REPLACE FUNCTION public.process_member_leave(
  p_member_id uuid,
  p_leave_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_member record;
  v_history_id uuid;
  v_duration_days integer;
  v_skills jsonb := '[]'::jsonb;
  v_activity record;
BEGIN
  -- Get member details
  SELECT * INTO v_member
  FROM public.club_members
  WHERE id = p_member_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Member not found or already inactive');
  END IF;

  -- Calculate duration
  v_duration_days := CURRENT_DATE - v_member.joined_date;

  -- Create history record
  INSERT INTO public.membership_history (
    user_id,
    child_id,
    club_id,
    member_name,
    joined_date,
    left_date,
    duration_days,
    leave_reason
  ) VALUES (
    v_member.user_id,
    v_member.child_id,
    v_member.club_id,
    v_member.name,
    v_member.joined_date,
    CURRENT_DATE,
    v_duration_days,
    p_leave_reason
  )
  RETURNING id INTO v_history_id;

  -- Collect skills from enrolled packages
  FOR v_activity IN
    SELECT DISTINCT a.id, a.title, a.description
    FROM public.package_enrollments pe
    JOIN public.package_activities pa ON pe.package_id = pa.package_id
    JOIN public.activities a ON pa.activity_id = a.id
    WHERE pe.member_id = p_member_id
  LOOP
    -- Add activity skills to member's acquired skills
    INSERT INTO public.member_acquired_skills (
      membership_history_id,
      skill_name,
      skill_category,
      acquired_from_activity_id
    )
    SELECT
      v_history_id,
      COALESCE(ask.skill_name, v_activity.title),
      ask.skill_category,
      v_activity.id
    FROM public.activity_skills ask
    WHERE ask.activity_id = v_activity.id
    ON CONFLICT DO NOTHING;

    -- If no predefined skills, create from activity title
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_skills WHERE activity_id = v_activity.id
    ) THEN
      INSERT INTO public.member_acquired_skills (
        membership_history_id,
        skill_name,
        acquired_from_activity_id
      ) VALUES (
        v_history_id,
        v_activity.title,
        v_activity.id
      );
    END IF;
  END LOOP;

  -- Deactivate package enrollments
  UPDATE public.package_enrollments
  SET is_active = false, updated_at = now()
  WHERE member_id = p_member_id;

  -- Update member status
  UPDATE public.club_members
  SET 
    is_active = false,
    left_date = CURRENT_DATE,
    leave_reason = p_leave_reason,
    updated_at = now()
  WHERE id = p_member_id;

  -- Get skills for response
  SELECT jsonb_agg(
    jsonb_build_object(
      'skill_name', skill_name,
      'skill_category', skill_category
    )
  ) INTO v_skills
  FROM public.member_acquired_skills
  WHERE membership_history_id = v_history_id;

  RETURN jsonb_build_object(
    'success', true,
    'history_id', v_history_id,
    'duration_days', v_duration_days,
    'skills_acquired', COALESCE(v_skills, '[]'::jsonb)
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_membership_history_user_id ON public.membership_history(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_history_club_id ON public.membership_history(club_id);
CREATE INDEX IF NOT EXISTS idx_member_acquired_skills_history_id ON public.member_acquired_skills(membership_history_id);