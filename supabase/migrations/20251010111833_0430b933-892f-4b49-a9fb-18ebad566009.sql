-- Add blood_type column to children table (optional field)
ALTER TABLE public.children
ADD COLUMN IF NOT EXISTS blood_type text;

-- Add comment for the column
COMMENT ON COLUMN public.children.blood_type IS 'Blood type of the child (A+, A-, B+, B-, AB+, AB-, O+, O-)';