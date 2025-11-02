-- Add member_id foreign key to club_instructors to link with club_members
ALTER TABLE public.club_instructors 
ADD COLUMN member_id UUID REFERENCES public.club_members(id) ON DELETE CASCADE;

-- Add club_rating column for club's rating of the instructor (separate from client ratings)
ALTER TABLE public.club_instructors 
ADD COLUMN club_rating NUMERIC(3,2) CHECK (club_rating >= 0 AND club_rating <= 5);

-- Add index for better performance
CREATE INDEX idx_club_instructors_member_id ON public.club_instructors(member_id);

-- Add instructor_role flag to club_members to identify members who are instructors
ALTER TABLE public.club_members
ADD COLUMN is_instructor BOOLEAN DEFAULT FALSE;

-- Create index for instructor queries
CREATE INDEX idx_club_members_is_instructor ON public.club_members(club_id, is_instructor) WHERE is_instructor = true;

COMMENT ON COLUMN public.club_instructors.member_id IS 'Links instructor to their club_members record for membership tracking';
COMMENT ON COLUMN public.club_instructors.club_rating IS 'Club admin rating of instructor performance (0-5)';
COMMENT ON COLUMN public.club_members.is_instructor IS 'Indicates if this member serves as an instructor for the club';