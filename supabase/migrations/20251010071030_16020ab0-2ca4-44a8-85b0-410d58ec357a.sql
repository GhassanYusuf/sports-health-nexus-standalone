-- Add child_code_prefix column to clubs table
ALTER TABLE public.clubs 
ADD COLUMN child_code_prefix text DEFAULT 'CHILD'::text;