-- Add nationality column to children table
ALTER TABLE public.children
ADD COLUMN nationality text NOT NULL DEFAULT 'Unknown';

-- Update existing children to have a default nationality
UPDATE public.children
SET nationality = 'Unknown'
WHERE nationality IS NULL;