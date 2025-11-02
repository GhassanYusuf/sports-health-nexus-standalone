-- Create function to increment club members count
CREATE OR REPLACE FUNCTION public.increment_club_members_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Only increment if the new member is active
  IF NEW.is_active = true THEN
    UPDATE public.clubs
    SET members_count = members_count + 1,
        updated_at = now()
    WHERE id = NEW.club_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function to decrement club members count
CREATE OR REPLACE FUNCTION public.decrement_club_members_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Decrement if old member was active
  IF OLD.is_active = true THEN
    UPDATE public.clubs
    SET members_count = GREATEST(0, members_count - 1),
        updated_at = now()
    WHERE id = OLD.club_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create function to handle member status changes
CREATE OR REPLACE FUNCTION public.update_club_members_count_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- If status changed from active to inactive, decrement
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.clubs
    SET members_count = GREATEST(0, members_count - 1),
        updated_at = now()
    WHERE id = NEW.club_id;
  END IF;
  
  -- If status changed from inactive to active, increment
  IF OLD.is_active = false AND NEW.is_active = true THEN
    UPDATE public.clubs
    SET members_count = members_count + 1,
        updated_at = now()
    WHERE id = NEW.club_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_increment_club_members_count ON public.club_members;
DROP TRIGGER IF EXISTS trigger_decrement_club_members_count ON public.club_members;
DROP TRIGGER IF EXISTS trigger_update_club_members_count_on_status_change ON public.club_members;

-- Create trigger for inserting new members
CREATE TRIGGER trigger_increment_club_members_count
AFTER INSERT ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.increment_club_members_count();

-- Create trigger for deleting members
CREATE TRIGGER trigger_decrement_club_members_count
AFTER DELETE ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.decrement_club_members_count();

-- Create trigger for updating member status
CREATE TRIGGER trigger_update_club_members_count_on_status_change
AFTER UPDATE OF is_active ON public.club_members
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
EXECUTE FUNCTION public.update_club_members_count_on_status_change();

-- Update the process_member_leave function to remove the manual decrement
-- since the trigger will handle it now
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

  -- Update member status (trigger will handle club count decrement)
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