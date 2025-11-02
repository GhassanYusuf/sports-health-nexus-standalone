-- Add blood_type column to profiles table
ALTER TABLE public.profiles
ADD COLUMN blood_type text;

-- Add comment for the column
COMMENT ON COLUMN public.profiles.blood_type IS 'Blood type of the user (A+, A-, B+, B-, AB+, AB-, O+, O-)';